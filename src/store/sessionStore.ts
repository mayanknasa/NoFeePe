import { create } from 'zustand';
import { Leg, PaymentMode, Session } from '../types';

/**
 * Session State interface defining mutable session parameters and actions.
 * All state is in-memory only per Section 2 (Hard Constraint 2).
 */
interface SessionState extends Session {
  /** Initialize an active payment session */
  initSession: (params: {
    payeeVpa: string;
    payeeName: string | null;
    merchantCode: string | null;
    transactionNote: string | null;
    signature: string | null;
    totalPaise: number;
    mode: PaymentMode;
    legs: number[]; // leg amounts in integer paise
  }) => void;

  /** Set whether an intent launch is currently in flight (double-tap guard) */
  setInFlight: (inFlight: boolean) => void;

  /** Remember the last chosen UPI package for quick selection */
  setLastUsedPackage: (pkg: string | null) => void;

  /** Set cooldown timer until a specific timestamp */
  setCooldown: (seconds: number) => void;

  /** Mark a leg as in progress */
  startLeg: (index: number, packageName?: string, appLabel?: string) => void;

  /** Mark a leg as successful and record settlement references */
  completeLeg: (
    index: number,
    txnId?: string,
    approvalRef?: string,
    raw?: string,
    packageName?: string,
    appLabel?: string
  ) => void;

  /** Mark a leg as failed */
  failLeg: (index: number) => void;

  /** Mark a leg as unknown/pending per Section 9.26 */
  markLegUnknown: (index: number, raw?: string) => void;

  /** Manually resolve an unknown leg after user verification */
  resolveUnknownLeg: (index: number, didSucceed: boolean) => void;

  /** Clear session state and return to clean initial state */
  resetSession: () => void;
}

/** Initial empty session state */
const initialSession: Session = {
  payeeVpa: '',
  payeeName: null,
  merchantCode: null,
  transactionNote: null,
  signature: null,
  totalPaise: 0,
  mode: 'direct',
  legs: [],
  lastUsedPackage: null,
  inFlight: false,
  cooldownUntil: null,
};

/**
 * Zustand Session Store.
 * Centralized, memory-only state management for active payment sessions.
 */
export const useSessionStore = create<SessionState>((set, get) => ({
  ...initialSession,

  initSession: ({
    payeeVpa,
    payeeName,
    merchantCode,
    transactionNote,
    signature,
    totalPaise,
    mode,
    legs,
  }) => {
    try {
      const legObjects: Leg[] = (legs ?? []).map((amountPaise, index) => ({
        index,
        amountPaise: amountPaise ?? 0,
        status: 'pending',
        attempts: 0,
      }));

      set({
        payeeVpa: payeeVpa ?? '',
        payeeName: payeeName ?? null,
        merchantCode: merchantCode ?? null,
        transactionNote: transactionNote ?? null,
        signature: signature ?? null,
        totalPaise: totalPaise ?? 0,
        mode: mode ?? 'direct',
        legs: legObjects,
        inFlight: false,
        cooldownUntil: null,
      });
    } catch (err: unknown) {
      console.warn('[SessionStore] initSession error:', err);
    }
  },

  setInFlight: (inFlight: boolean) => set({ inFlight: !!inFlight }),

  setLastUsedPackage: (lastUsedPackage: string | null) => set({ lastUsedPackage }),

  setCooldown: (seconds: number) => {
    try {
      const cooldownUntil = Date.now() + (seconds ?? 3) * 1000;
      set({ cooldownUntil });
    } catch (err: unknown) {
      console.warn('[SessionStore] setCooldown error:', err);
    }
  },

  startLeg: (index: number, packageName?: string, appLabel?: string) => {
    try {
      const legs = [...(get()?.legs ?? [])];
      const target = legs[index];
      if (target) {
        target.status = 'in_progress';
        target.attempts = (target.attempts ?? 0) + 1;
        if (packageName) target.packageName = packageName;
        if (appLabel) target.appLabel = appLabel;
      }
      set({ legs, inFlight: true });
    } catch (err: unknown) {
      console.warn('[SessionStore] startLeg error:', err);
    }
  },

  completeLeg: (
    index: number,
    txnId?: string,
    approvalRef?: string,
    raw?: string,
    packageName?: string,
    appLabel?: string
  ) => {
    try {
      const legs = [...(get()?.legs ?? [])];
      const target = legs[index];
      if (target) {
        target.status = 'success';
        target.txnId = txnId ?? '';
        target.approvalRef = approvalRef ?? '';
        target.rawResponse = raw ?? '';
        target.completedAt = Date.now();
        if (packageName) target.packageName = packageName;
        if (appLabel) target.appLabel = appLabel;
      }
      // 3 second cooldown per Section 4.5
      const cooldownUntil = Date.now() + 3000;
      set({ legs, inFlight: false, cooldownUntil });
    } catch (err: unknown) {
      console.warn('[SessionStore] completeLeg error:', err);
    }
  },

  failLeg: (index: number) => {
    try {
      const legs = [...(get()?.legs ?? [])];
      const target = legs[index];
      if (target) {
        target.status = 'failed';
      }
      set({ legs, inFlight: false });
    } catch (err: unknown) {
      console.warn('[SessionStore] failLeg error:', err);
    }
  },

  markLegUnknown: (index: number, raw?: string) => {
    try {
      const legs = [...(get()?.legs ?? [])];
      const target = legs[index];
      if (target) {
        target.status = 'unknown';
        target.rawResponse = raw ?? '';
      }
      set({ legs, inFlight: false });
    } catch (err: unknown) {
      console.warn('[SessionStore] markLegUnknown error:', err);
    }
  },

  resolveUnknownLeg: (index: number, didSucceed: boolean) => {
    try {
      const legs = [...(get()?.legs ?? [])];
      const target = legs[index];
      if (target) {
        if (didSucceed) {
          target.status = 'success';
          target.completedAt = Date.now();
        } else {
          target.status = 'failed';
        }
      }
      set({ legs });
    } catch (err: unknown) {
      console.warn('[SessionStore] resolveUnknownLeg error:', err);
    }
  },

  resetSession: () => {
    try {
      set({ ...initialSession });
    } catch (err: unknown) {
      console.warn('[SessionStore] resetSession error:', err);
    }
  },
}));

/**
 * Derived selectors (computed on demand, never persisted in state per Section 8).
 * Guarded with optional chaining to guarantee zero runtime TypeErrors.
 */
export const selectPaidPaise = (state: Session): number =>
  state?.legs
    ?.filter((leg) => leg?.status === 'success')
    ?.reduce((sum, leg) => sum + (leg?.amountPaise ?? 0), 0) ?? 0;

export const selectRemainingPaise = (state: Session): number =>
  (state?.totalPaise ?? 0) - selectPaidPaise(state);

export const selectDoneCount = (state: Session): number =>
  state?.legs?.filter((leg) => leg?.status === 'success')?.length ?? 0;

export const selectTotalCount = (state: Session): number =>
  state?.legs?.length ?? 0;

export const selectNextPendingLeg = (state: Session): Leg | undefined =>
  state?.legs?.find((leg) => leg?.status === 'pending' || leg?.status === 'failed');
