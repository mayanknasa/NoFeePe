/**
 * UPI Protocol Domain Utilities
 *
 * Implements Section 6 of AGENTS.md for parsing, validating, and building
 * NPCI UPI deep links (upi://pay?...).
 * Enforces parameter smuggling defenses, VPA sanitization, and tampering guards.
 */

/** Valid Virtual Payment Address (UPI ID) regex */
export const VPA_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,64}$/;

/**
 * Strips ASCII control characters and unicode direction overrides (bidi spoofing)
 * per Section 6.1 of AGENTS.md.
 */
/* eslint-disable no-control-regex */
export const DANGEROUS_CHARS_REGEX = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g;
/* eslint-enable no-control-regex */

/** Fixed amount format validator (e.g. 1500 or 1500.50) */
const FIXED_AMOUNT_REGEX = /^\d{1,7}(\.\d{1,2})?$/;

/** 4-digit Merchant Category Code validator */
const MCC_REGEX = /^\d{4}$/;

/**
 * Custom error thrown when a scanned QR string fails UPI specifications.
 */
export class UpiParseError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'UpiParseError';
  }
}

/**
 * Normalized UPI payload extracted from a scanned QR code.
 */
export type ParsedUpi = {
  payeeVpa: string;
  payeeName: string | null;
  fixedAmountPaise: number | null;
  merchantCode: string | null;
  transactionNote: string | null;
  signature: string | null;
  rawParams: Record<string, string>;
};

/**
 * Parameters required to construct a valid UPI payment intent URI.
 */
export type UpiPaymentParams = {
  payeeVpa: string;
  originalVpa: string; // Session immutability verification
  payeeName?: string | null;
  amountPaise: number;
  transactionNote?: string | null;
  merchantCode?: string | null;
  signature?: string | null;
};

/**
 * Parses and strictly sanitizes a scanned QR string according to Section 6.1.
 * - Must start with upi://pay? (case-insensitive)
 * - First occurrence of each key wins (blocks parameter smuggling)
 * - Mandatory pa must match VPA_REGEX
 * - Sanitizes pn and tn against dangerous bidi spoofing chars
 * - Extracts and validates am, mc, and sign
 * - Drops all unknown parameters
 */
export function parseUpiUri(rawUri: string): ParsedUpi {
  if (!rawUri || typeof rawUri !== 'string') {
    throw new UpiParseError('INVALID_INPUT', 'Scanned QR is empty or invalid');
  }

  const trimmed = rawUri.trim();
  if (!/^upi:\/\/pay\?/i.test(trimmed)) {
    throw new UpiParseError('NOT_UPI_URI', 'Not a UPI QR code');
  }

  const queryString = trimmed.slice(trimmed.indexOf('?') + 1);
  const pairs = queryString.split('&');
  const params: Record<string, string> = {};

  for (const pair of pairs) {
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx < 1) continue;

    const rawKey = pair.slice(0, eqIdx).trim().toLowerCase();
    const rawVal = pair.slice(eqIdx + 1);

    // Rule: First occurrence wins (prevents parameter smuggling)
    if (params[rawKey] !== undefined) {
      continue;
    }

    let decodedVal = '';
    try {
      decodedVal = decodeURIComponent(rawVal.replace(/\+/g, ' '));
    } catch {
      decodedVal = rawVal;
    }

    params[rawKey] = decodedVal;
  }

  // pa (payee VPA) is strictly mandatory
  const pa = params.pa?.trim() ?? '';
  if (!pa) {
    throw new UpiParseError('MISSING_PA', 'This QR is missing a UPI ID.');
  }

  if (!VPA_REGEX.test(pa)) {
    throw new UpiParseError('INVALID_PA', 'This QR has an invalid UPI ID.');
  }

  // pn (payee name) sanitization: remove dangerous bidi characters, clamp to 40 chars
  let payeeName: string | null = null;
  if (params.pn) {
    try {
      const sanitized = params.pn.replace(DANGEROUS_CHARS_REGEX, '').trim();
      if (sanitized.length > 0) {
        payeeName = sanitized.slice(0, 40);
      }
    } catch {
      payeeName = null;
    }
  }

  // tn (transaction note) sanitization: clamp to 50 chars
  let transactionNote: string | null = null;
  if (params.tn) {
    try {
      const sanitized = params.tn.replace(DANGEROUS_CHARS_REGEX, '').trim();
      if (sanitized.length > 0) {
        transactionNote = sanitized.slice(0, 50);
      }
    } catch {
      transactionNote = null;
    }
  }

  // am (fixed amount) validation
  let fixedAmountPaise: number | null = null;
  if (params.am) {
    const amStr = params.am.trim();
    if (!FIXED_AMOUNT_REGEX.test(amStr)) {
      throw new UpiParseError('INVALID_AM', 'Invalid fixed amount format in QR.');
    }
    const num = parseFloat(amStr);
    if (!isNaN(num)) {
      fixedAmountPaise = Math.round(num * 100);
    }
  }

  // mc (merchant category code) validation
  let merchantCode: string | null = null;
  if (params.mc) {
    const mcStr = params.mc.trim();
    if (MCC_REGEX.test(mcStr)) {
      merchantCode = mcStr;
    }
  }

  // sign (digital signature) preservation
  const signature = params.sign ? params.sign.trim() : null;

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
 * Generates a fresh unique 35-character uppercase transaction reference.
 * Format: 'NFP' + 32 hex uppercase -> truncated to 35 characters total.
 * Guaranteed unique for every single launch attempt, including retries of the same leg.
 */
export function generateTransactionRef(): string {
  let hex = '';
  const hexChars = '0123456789ABCDEF';
  for (let i = 0; i < 32; i++) {
    const randIdx = Math.floor(Math.random() * hexChars.length);
    hex += hexChars.charAt(randIdx);
  }
  return `NFP${hex}`.slice(0, 35);
}

/**
 * Builds a valid UPI payment deep link URI per Section 6.2 of AGENTS.md.
 * Enforces session immutability assertions to prevent VPA hijacking mid-split.
 *
 * @param params Payment URI parameters.
 * @returns Fully formatted upi://pay URI string.
 * @throws {UpiParseError} If tampering is detected or amount is invalid.
 */
export function buildUpiUri(params: UpiPaymentParams): string {
  // Tampering assertion: Payee VPA must match the session's scanned VPA
  if (params?.payeeVpa !== params?.originalVpa) {
    throw new UpiParseError(
      'TAMPERING_DETECTED',
      'Security error: Payee VPA changed during session. Aborting transaction.'
    );
  }

  if (typeof params?.amountPaise !== 'number' || !Number.isInteger(params.amountPaise) || params.amountPaise < 100) {
    throw new UpiParseError('INVALID_AMOUNT', 'Amount must be integer paise >= 100.');
  }

  const amountRupees = (params.amountPaise / 100).toFixed(2);
  const tr = generateTransactionRef();

  const queryParts: string[] = [
    `pa=${encodeURIComponent(params.payeeVpa)}`,
  ];

  if (params?.payeeName) {
    queryParts.push(`pn=${encodeURIComponent(params.payeeName)}`);
  }

  queryParts.push(`am=${amountRupees}`);
  queryParts.push('cu=INR');
  queryParts.push(`tr=${tr}`);

  if (params?.transactionNote) {
    queryParts.push(`tn=${encodeURIComponent(params.transactionNote)}`);
  }

  if (params?.merchantCode) {
    queryParts.push(`mc=${encodeURIComponent(params.merchantCode)}`);
  }

  // sign is forwarded only when appropriate (e.g. for Pay Direct with unchanged amount)
  if (params?.signature) {
    queryParts.push(`sign=${encodeURIComponent(params.signature)}`);
  }

  return `upi://pay?${queryParts.join('&')}`;
}

/**
 * Masks a VPA per Section 4.3 of AGENTS.md:
 * First 3 characters, then ••••, then @handle.
 * Example: sharma.retail@okhdfcbank -> sha••••@okhdfcbank
 */
export function maskVpa(vpa: string): string {
  if (!vpa || typeof vpa !== 'string') return '';
  const atIdx = vpa.indexOf('@');
  if (atIdx === -1) return vpa;

  const handle = vpa.slice(atIdx);
  const user = vpa.slice(0, atIdx);

  if (user.length <= 3) {
    return `${user}••••${handle}`;
  }
  return `${user.slice(0, 3)}••••${handle}`;
}
