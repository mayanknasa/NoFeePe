import {
  parseUpiUri,
  buildUpiUri,
  maskVpa,
  generateTransactionRef,
  UpiParseError,
} from '../src/domain/upi';

describe('UPI URI Handling (Section 6)', () => {
  test('Parses valid basic UPI URI', () => {
    const raw = 'upi://pay?pa=merchant@okhdfcbank&pn=Sharma%20Electronics&mc=5411';
    const parsed = parseUpiUri(raw);

    expect(parsed.payeeVpa).toBe('merchant@okhdfcbank');
    expect(parsed.payeeName).toBe('Sharma Electronics');
    expect(parsed.merchantCode).toBe('5411');
    expect(parsed.fixedAmountPaise).toBeNull();
  });

  test('Rejects non-UPI URI', () => {
    expect(() => parseUpiUri('https://example.com/pay')).toThrow(UpiParseError);
    try {
      parseUpiUri('https://example.com/pay');
    } catch (e: unknown) {
      if (e instanceof UpiParseError) {
        expect(e.code).toBe('NOT_UPI_URI');
      } else {
        throw e;
      }
    }
  });

  test('Rejects UPI URI missing pa', () => {
    expect(() => parseUpiUri('upi://pay?pn=Sharma')).toThrow(UpiParseError);
    try {
      parseUpiUri('upi://pay?pn=Sharma');
    } catch (e: unknown) {
      if (e instanceof UpiParseError) {
        expect(e.code).toBe('MISSING_PA');
      } else {
        throw e;
      }
    }
  });

  test('Rejects invalid VPA format', () => {
    expect(() => parseUpiUri('upi://pay?pa=invalid_vpa_without_handle')).toThrow(UpiParseError);
    try {
      parseUpiUri('upi://pay?pa=invalid_vpa_without_handle');
    } catch (e: unknown) {
      if (e instanceof UpiParseError) {
        expect(e.code).toBe('INVALID_PA');
      } else {
        throw e;
      }
    }
  });

  test('Parameter smuggling: First occurrence of key wins', () => {
    const raw = 'upi://pay?pa=legit@bank&pa=attacker@evilbank&pn=First&pn=Second';
    const parsed = parseUpiUri(raw);

    expect(parsed.payeeVpa).toBe('legit@bank');
    expect(parsed.payeeName).toBe('First');
  });

  test('Sanitizes dangerous and RTL override characters from pn and tn', () => {
    // \u202E is Right-to-Left Override, \u0007 is bell/control character
    const raw = 'upi://pay?pa=valid@bank&pn=Bad\u202EName\u0007Here&tn=Test\u202ASpoof';
    const parsed = parseUpiUri(raw);

    expect(parsed.payeeName).toBe('BadNameHere');
    expect(parsed.transactionNote).toBe('TestSpoof');
  });

  test('Clamps pn to 40 chars and tn to 50 chars', () => {
    const longName = 'A'.repeat(60);
    const longNote = 'B'.repeat(80);
    const raw = `upi://pay?pa=valid@bank&pn=${longName}&tn=${longNote}`;
    const parsed = parseUpiUri(raw);

    expect(parsed.payeeName?.length).toBe(40);
    expect(parsed.transactionNote?.length).toBe(50);
  });

  test('Parses fixed amount accurately', () => {
    const raw = 'upi://pay?pa=shop@upi&am=1250.50';
    const parsed = parseUpiUri(raw);

    expect(parsed.fixedAmountPaise).toBe(125050);
  });

  test('Builds payment URI with fresh unique reference', () => {
    const uri1 = buildUpiUri({
      payeeVpa: 'user@okhdfcbank',
      originalVpa: 'user@okhdfcbank',
      payeeName: 'User Name',
      amountPaise: 199900,
    });

    const uri2 = buildUpiUri({
      payeeVpa: 'user@okhdfcbank',
      originalVpa: 'user@okhdfcbank',
      payeeName: 'User Name',
      amountPaise: 199900,
    });

    expect(uri1).toContain('pa=user%40okhdfcbank');
    expect(uri1).toContain('am=1999.00');
    expect(uri1).toContain('cu=INR');
    expect(uri1).toContain('tr=NFP');

    // tr must be unique on every launch attempt
    const tr1Match = uri1.match(/tr=(NFP[A-Z0-9]+)/);
    const tr2Match = uri2.match(/tr=(NFP[A-Z0-9]+)/);
    expect(tr1Match).toBeTruthy();
    expect(tr2Match).toBeTruthy();
    expect(tr1Match![1]).not.toBe(tr2Match![1]);
    expect(tr1Match![1].length).toBeLessThanOrEqual(35);
  });

  test('Tampering check: throws if payeeVpa does not match originalVpa', () => {
    expect(() =>
      buildUpiUri({
        payeeVpa: 'tampered@evil',
        originalVpa: 'user@okhdfcbank',
        amountPaise: 10000,
      })
    ).toThrow(UpiParseError);

    try {
      buildUpiUri({
        payeeVpa: 'tampered@evil',
        originalVpa: 'user@okhdfcbank',
        amountPaise: 10000,
      });
    } catch (e: unknown) {
      if (e instanceof UpiParseError) {
        expect(e.code).toBe('TAMPERING_DETECTED');
      } else {
        throw e;
      }
    }
  });

  test('maskVpa masks username keeping first 3 chars and handle', () => {
    expect(maskVpa('sharma.retail@okhdfcbank')).toBe('sha••••@okhdfcbank');
    expect(maskVpa('mayank@upi')).toBe('may••••@upi');
    expect(maskVpa('ab@okaxis')).toBe('ab••••@okaxis');
    expect(maskVpa('abc@okaxis')).toBe('abc••••@okaxis');
  });

  test('generateTransactionRef creates unique 35-char NFP references', () => {
    const ref1 = generateTransactionRef();
    const ref2 = generateTransactionRef();

    expect(ref1).toHaveLength(35);
    expect(ref2).toHaveLength(35);
    expect(ref1.startsWith('NFP')).toBe(true);
    expect(ref2.startsWith('NFP')).toBe(true);
    expect(ref1).not.toBe(ref2);
    expect(/^NFP[0-9A-F]{32}$/.test(ref1)).toBe(true);
  });
});
