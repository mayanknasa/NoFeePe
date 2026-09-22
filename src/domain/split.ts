/**
 * Split & Pay Domain Logic
 *
 * Implements Section 5 of the NoFeePe specification.
 * Pure mathematical module responsible for calculating payment instalments
 * capped at Rs 1,999.00 (199,900 paise) to prevent merchant interchange fees
 * on UPI transactions without violating transaction limits.
 */

/** Maximum cap per installment leg in integer paise: Rs 1,999.00 */
export const LEG_CAP_PAISE = 199_900;

/** Minimum payable transaction floor per NPCI guidelines: Rs 1.00 */
export const MIN_LEG_PAISE = 100;

/** Maximum installment legs supported in a single session */
export const MAX_LEGS = 100;

/** Maximum total transaction supported: Rs 1,00,000 (10,000,000 paise) */
export const MAX_TOTAL_PAISE = 10_000_000;

/**
 * Result structure of a calculated split plan.
 */
export type SplitPlan = {
  /** Array of installment amounts in integer paise */
  legs: number[];
  /** Total sum of all legs in integer paise */
  totalPaise: number;
  /** Number of installment legs */
  count: number;
};

/**
 * Custom error class for split calculation failures.
 */
export class SplitError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'SplitError';
  }
}

/**
 * Plans and splits a total amount in paise into discrete installment legs.
 *
 * Algorithm Rules (Section 5):
 * 1. Validates integer paise, minimum Rs 1, and maximum Rs 1,00,000.
 * 2. Amounts <= Rs 1,999 are returned as a single leg.
 * 3. Amounts > Rs 1,999 are divided into full legs of Rs 1,999 each.
 * 4. If the remainder is < Rs 1.00, it cannot be processed as its own UPI transaction.
 *    The remainder is merged into the last full leg and rebalanced across the final
 *    two legs so neither leg exceeds the Rs 1,999 cap.
 * 5. Asserts the invariant sum(legs) === totalPaise.
 *
 * @param totalPaise Total transaction amount in integer paise.
 * @returns Calculated SplitPlan.
 * @throws {SplitError} If amount is invalid or exceeds allowable limits.
 */
export function planSplit(totalPaise: number): SplitPlan {
  // Defensive validation
  if (typeof totalPaise !== 'number' || !Number.isInteger(totalPaise)) {
    throw new SplitError('NOT_INTEGER', 'Amount must be integer paise');
  }
  if (totalPaise < MIN_LEG_PAISE) {
    throw new SplitError('TOO_SMALL', 'Minimum payable amount is Rs 1');
  }
  if (totalPaise > MAX_TOTAL_PAISE) {
    throw new SplitError('TOO_LARGE', 'Maximum supported amount is Rs 1,00,000');
  }

  // Single leg if at or below cap
  if (totalPaise <= LEG_CAP_PAISE) {
    return { legs: [totalPaise], totalPaise, count: 1 };
  }

  const fullLegs = Math.floor(totalPaise / LEG_CAP_PAISE);
  const remainder = totalPaise - fullLegs * LEG_CAP_PAISE;
  const legs: number[] = new Array(fullLegs).fill(LEG_CAP_PAISE);

  if (remainder === 0) {
    // Exact multiple of Rs 1,999; no remainder leg needed
  } else if (remainder < MIN_LEG_PAISE) {
    // Remainder is under Rs 1.00 and cannot be its own UPI transaction.
    // Merge it into the last full leg and rebalance the final two legs so neither exceeds the cap.
    const lastLeg = legs.pop() ?? LEG_CAP_PAISE;
    const merged = lastLeg + remainder;
    const a = Math.floor(merged / 2);
    legs.push(a, merged - a);
  } else {
    // Normal remainder of Rs 1.00 or more
    legs.push(remainder);
  }

  if ((legs?.length ?? 0) > MAX_LEGS) {
    throw new SplitError(
      'TOO_MANY_LEGS',
      `This needs ${legs?.length ?? 0} payments. Most banks cap UPI at around 20 per day.`
    );
  }

  // Verify sum invariant
  const sum = legs?.reduce((acc, curr) => acc + (curr ?? 0), 0) ?? 0;
  if (sum !== totalPaise) {
    throw new SplitError('INVARIANT', 'Split does not sum to total');
  }

  return { legs, totalPaise, count: legs.length };
}
