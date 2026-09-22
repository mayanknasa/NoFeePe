import {
  planSplit,
  SplitError,
  LEG_CAP_PAISE,
  MIN_LEG_PAISE,
  MAX_TOTAL_PAISE,
  MAX_LEGS,
} from '../src/domain/split';

describe('Split Algorithm (Section 5)', () => {
  test('1999.00 -> 1 leg of 1999.00', () => {
    const plan = planSplit(199_900);
    expect(plan.legs).toEqual([199_900]);
    expect(plan.count).toBe(1);
    expect(plan.totalPaise).toBe(199_900);
  });

  test('1999.01 -> 2 legs: merges & rebalances to 999.50 + 999.51', () => {
    const plan = planSplit(199_901);
    expect(plan.legs).toEqual([99_950, 99_951]);
    expect(plan.count).toBe(2);
    expect(plan.totalPaise).toBe(199_901);
    expect(plan.legs.reduce((a, b) => a + b, 0)).toBe(199_901);
  });

  test('2000.00 -> 2 legs: 1999.00 + 1.00', () => {
    const plan = planSplit(200_000);
    expect(plan.legs).toEqual([199_900, 100]);
    expect(plan.count).toBe(2);
    expect(plan.totalPaise).toBe(200_000);
  });

  test('10000.00 -> 6 legs: 5 x 1999.00 + 5.00', () => {
    const plan = planSplit(1_000_000);
    expect(plan.legs).toEqual([
      199_900,
      199_900,
      199_900,
      199_900,
      199_900,
      500,
    ]);
    expect(plan.count).toBe(6);
    expect(plan.totalPaise).toBe(1_000_000);
  });

  test('4500.75 -> 3 legs: 1999.00, 1999.00, 502.75', () => {
    const plan = planSplit(450_075);
    expect(plan.legs).toEqual([199_900, 199_900, 50_275]);
    expect(plan.count).toBe(3);
    expect(plan.totalPaise).toBe(450_075);
  });

  test('3998.00 -> 2 legs of 1999.00, no remainder leg', () => {
    const plan = planSplit(399_800);
    expect(plan.legs).toEqual([199_900, 199_900]);
    expect(plan.count).toBe(2);
    expect(plan.totalPaise).toBe(399_800);
  });

  test('39980.00 -> 20 legs, allowed', () => {
    const plan = planSplit(3_998_000);
    expect(plan.count).toBe(20);
    expect(plan.legs.length).toBe(20);
    expect(plan.legs.every((l) => l === 199_900)).toBe(true);
    expect(plan.totalPaise).toBe(3_998_000);
  });

  test('90000.25 -> 46 legs (45 of 1999.00 + 1 of 45.25), correctly planned', () => {
    const plan = planSplit(9_000_025);
    expect(plan.count).toBe(46);
    expect(plan.legs.length).toBe(46);
    expect(plan.legs.slice(0, 45).every((l) => l === 199_900)).toBe(true);
    expect(plan.legs[45]).toBe(4_525);
    expect(plan.totalPaise).toBe(9_000_025);
    expect(plan.legs.reduce((a, b) => a + b, 0)).toBe(9_000_025);
  });

  test('100001.00 -> throws TOO_LARGE', () => {
    expect(() => planSplit(10_000_100)).toThrow(SplitError);
    try {
      planSplit(10_000_100);
    } catch (err: any) {
      expect(err.code).toBe('TOO_LARGE');
    }
  });

  test('0.50 -> throws TOO_SMALL', () => {
    expect(() => planSplit(50)).toThrow(SplitError);
    try {
      planSplit(50);
    } catch (err: any) {
      expect(err.code).toBe('TOO_SMALL');
    }
  });

  test('Non-integer throws NOT_INTEGER', () => {
    expect(() => planSplit(100.5)).toThrow(SplitError);
    try {
      planSplit(100.5);
    } catch (err: any) {
      expect(err.code).toBe('NOT_INTEGER');
    }
  });

  test('Property test: 5,000 random amounts between 100 and 10,000,000 paise', () => {
    for (let i = 0; i < 5000; i++) {
      const amount = Math.floor(
        Math.random() * (MAX_TOTAL_PAISE - MIN_LEG_PAISE + 1) + MIN_LEG_PAISE
      );

      try {
        const plan = planSplit(amount);
        const sum = plan.legs.reduce((a, b) => a + b, 0);

        expect(sum).toBe(amount);
        expect(plan.totalPaise).toBe(amount);
        expect(plan.legs.length).toBeLessThanOrEqual(MAX_LEGS);
        for (const leg of plan.legs) {
          expect(leg).toBeLessThanOrEqual(LEG_CAP_PAISE);
          expect(leg).toBeGreaterThanOrEqual(MIN_LEG_PAISE);
        }
      } catch (err: any) {
        // If amount produces > 20 legs, TOO_MANY_LEGS is expected and valid
        if (err instanceof SplitError && err.code === 'TOO_MANY_LEGS') {
          continue;
        }
        throw err;
      }
    }
  });
});
