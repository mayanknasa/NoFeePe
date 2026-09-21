export const VPA_REGEX = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$/;
export const DANGEROUS_CHARS_REGEX = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g;
const FIXED_AMOUNT_REGEX = /^\d{1,7}(\.\d{1,2})?$/;
const MCC_REGEX = /^\d{4}$/;

export class UpiParseError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'UpiParseError';
  }
}

export type ParsedUpi = {
  payeeVpa: string;
  payeeName: string | null;
  fixedAmountPaise: number | null;
  merchantCode: string | null;
  transactionNote: string | null;
  signature: string | null;
  rawParams: Record<string, string>;
};

export type UpiPaymentParams = {
  payeeVpa: string;
  originalVpa: string; // for tampering check
  payeeName?: string | null;
  amountPaise: number;
  transactionNote?: string | null;
  merchantCode?: string | null;
  signature?: string | null;
};

/**
 * Parses raw UPI QR code string according to Section 6.1 of AGENTS.md.
 * First occurrence of each query parameter wins to prevent parameter smuggling.
 */
export function parseUpiUri(raw: string): ParsedUpi {
  if (!raw || typeof raw !== 'string') {
    throw new UpiParseError('INVALID_INPUT', 'Scanned QR is empty or invalid');
  }

  const trimmed = raw.trim();
  const prefix = 'upi://pay?';
  if (!trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
    throw new UpiParseError('NOT_UPI_URI', 'Not a UPI QR code');
  }

  const queryString = trimmed.slice(prefix.length);
  const pairs = queryString.split('&');
  const params: Record<string, string> = {};

  for (const pair of pairs) {
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;

    const rawKey = pair.slice(0, eqIdx);
    const rawVal = pair.slice(eqIdx + 1);

    const key = decodeURIComponent(rawKey).trim();
    // First occurrence wins, later duplicates discarded
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      continue;
    }

    let decodedVal = '';
    try {
      decodedVal = decodeURIComponent(rawVal.replace(/\+/g, ' '));
    } catch {
      decodedVal = rawVal;
    }

    params[key] = decodedVal;
  }

  // pa is mandatory
  const pa = params['pa'];
  if (!pa) {
    throw new UpiParseError('MISSING_PA', 'This QR is missing a UPI ID.');
  }

  if (!VPA_REGEX.test(pa)) {
    throw new UpiParseError('INVALID_PA', 'This QR has an invalid UPI ID.');
  }

  // pn sanitization
  let payeeName: string | null = null;
  if (params['pn']) {
    const sanitized = params['pn'].replace(DANGEROUS_CHARS_REGEX, '').trim();
    if (sanitized.length > 0) {
      payeeName = sanitized.slice(0, 40);
    }
  }

  // tn sanitization
  let transactionNote: string | null = null;
  if (params['tn']) {
    const sanitized = params['tn'].replace(DANGEROUS_CHARS_REGEX, '').trim();
    if (sanitized.length > 0) {
      transactionNote = sanitized.slice(0, 50);
    }
  }

  // am validation
  let fixedAmountPaise: number | null = null;
  if (params['am']) {
    const amStr = params['am'].trim();
    if (!FIXED_AMOUNT_REGEX.test(amStr)) {
      throw new UpiParseError('INVALID_AM', 'Invalid fixed amount format in QR.');
    }
    const num = parseFloat(amStr);
    fixedAmountPaise = Math.round(num * 100);
  }

  // mc validation
  let merchantCode: string | null = null;
  if (params['mc']) {
    const mcStr = params['mc'].trim();
    if (MCC_REGEX.test(mcStr)) {
      merchantCode = mcStr;
    }
  }

  // sign preservation
  const signature = params['sign'] ? params['sign'].trim() : null;

  return {
    payeeVpa: pa,
    payeeName,
    fixedAmountPaise,
    merchantCode,
    transactionNote,
    signature,
    rawParams: params,
  };
}

/**
 * Generates a fresh unique 35-char uppercase transaction reference.
 * Format: NFP + 32 hex uppercase -> truncated to 35 total.
 */
export function generateTransactionRef(): string {
  let hex = '';
  const hexChars = '0123456789ABCDEF';
  for (let i = 0; i < 32; i++) {
    hex += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
  }
  return `NFP${hex}`.slice(0, 35);
}

/**
 * Builds a payment URI per Section 6.2 of AGENTS.md.
 * Checks for session VPA tampering.
 */
export function buildUpiUri(params: UpiPaymentParams): string {
  // Tampering assertion: Payee VPA is immutable for the whole session
  if (params.payeeVpa !== params.originalVpa) {
    throw new UpiParseError(
      'TAMPERING_DETECTED',
      'Security error: Payee VPA changed during session. Aborting transaction.'
    );
  }

  if (!Number.isInteger(params.amountPaise) || params.amountPaise < 100) {
    throw new UpiParseError('INVALID_AMOUNT', 'Amount must be integer paise >= 100.');
  }

  const amountRupees = (params.amountPaise / 100).toFixed(2);
  const tr = generateTransactionRef();

  const queryParts: string[] = [
    `pa=${encodeURIComponent(params.payeeVpa)}`,
  ];

  if (params.payeeName) {
    queryParts.push(`pn=${encodeURIComponent(params.payeeName)}`);
  }

  queryParts.push(`am=${amountRupees}`);
  queryParts.push('cu=INR');
  queryParts.push(`tr=${tr}`);

  if (params.transactionNote) {
    queryParts.push(`tn=${encodeURIComponent(params.transactionNote)}`);
  }

  if (params.merchantCode) {
    queryParts.push(`mc=${encodeURIComponent(params.merchantCode)}`);
  }

  // sign only if provided (e.g. for Pay Direct with unchanged amount)
  if (params.signature) {
    queryParts.push(`sign=${encodeURIComponent(params.signature)}`);
  }

  return `upi://pay?${queryParts.join('&')}`;
}

/**
 * Masks a VPA per Section 4.3 and 11.8 of AGENTS.md:
 * First 3 characters, then ••••, then @handle.
 * Example: sharma.retail@okhdfcbank -> sha••••@okhdfcbank
 */
export function maskVpa(vpa: string): string {
  if (!vpa) return '';
  const atIdx = vpa.indexOf('@');
  if (atIdx === -1) return vpa;

  const handle = vpa.slice(atIdx);
  const user = vpa.slice(0, atIdx);

  if (user.length <= 3) {
    return `${user}••••${handle}`;
  }
  return `${user.slice(0, 3)}••••${handle}`;
}
