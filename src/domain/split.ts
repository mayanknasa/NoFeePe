export const LEG_CAP_PAISE = 199_900; // Rs 1999.00
export const MIN_LEG_PAISE = 100; // Rs 1.00, UPI floor
export const MAX_LEGS = 20;
export const MAX_TOTAL_PAISE = 10_000_000; // Rs 1,00,000

export type SplitPlan = { legs: number[]; totalPaise: number; count: number };

export class SplitError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'SplitError';
  }
}

export function planSplit(totalPaise: number): SplitPlan {
  if (!Number.isInteger(totalPaise)) {
    throw new SplitError('NOT_INTEGER', 'Amount must be integer paise');
  }
  if (totalPaise < MIN_LEG_PAISE) {
    throw new SplitError('TOO_SMALL', 'Minimum payable amount is Rs 1');
  }
  if (totalPaise > MAX_TOTAL_PAISE) {
    throw new SplitError('TOO_LARGE', 'Maximum supported amount is Rs 1,00,000');
  }

  if (totalPaise <= LEG_CAP_PAISE) {
    return { legs: [totalPaise], totalPaise, count: 1 };
  }

  const fullLegs = Math.floor(totalPaise / LEG_CAP_PAISE);
  const remainder = totalPaise - fullLegs * LEG_CAP_PAISE;
  const legs: number[] = new Array(fullLegs).fill(LEG_CAP_PAISE);

  if (remainder === 0) {
    // exact multiple of 1999, nothing to append
  } else if (remainder < MIN_LEG_PAISE) {
    // remainder is under Rs 1 and cannot be its own UPI transaction.
    // Merge it into the last full leg and rebalance the final two legs so
    // neither exceeds the cap.
    const merged = legs.pop()! + remainder;
    const a = Math.floor(merged / 2);
    legs.push(a, merged - a);
  } else {
    legs.push(remainder);
  }

  if (legs.length > MAX_LEGS) {
    throw new SplitError(
      'TOO_MANY_LEGS',
      `This needs ${legs.length} payments. Most banks cap UPI at around 20 per day.`
    );
  }

  const sum = legs.reduce((a, b) => a + b, 0);
  if (sum !== totalPaise) throw new SplitError('INVARIANT', 'Split does not sum to total');

  return { legs, totalPaise, count: legs.length };
}
