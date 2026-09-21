import { create } from 'zustand';
import { Leg, PaymentMode, Session } from '../types';

interface SessionState extends Session {
  // Actions
  initSession: (params: {
    payeeVpa: string;
    payeeName: string | null;
    merchantCode: string | null;
    transactionNote: string | null;
    signature: string | null;
    totalPaise: number;
    mode: PaymentMode;
    legs: number[]; // leg amounts in paise
  }) => void;

  setInFlight: (inFlight: boolean) => void;
  setLastUsedPackage: (pkg: string | null) => void;
  setCooldown: (seconds: number) => void;

  startLeg: (index: number) => void;
  completeLeg: (index: number, txnId?: string, approvalRef?: string, raw?: string) => void;
  failLeg: (index: number) => void;
  markLegUnknown: (index: number, raw?: string) => void;
  resolveUnknownLeg: (index: number, didSucceed: boolean) => void;
  resetSession: () => void;
}

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
    const legObjects: Leg[] = legs.map((amountPaise, index) => ({
      index,
      amountPaise,
      status: 'pending',
      attempts: 0,
    }));

    set({
      payeeVpa,
      payeeName,
      merchantCode,
      transactionNote,
      signature,
      totalPaise,
      mode,
      legs: legObjects,
      inFlight: false,
      cooldownUntil: null,
    });
  },

  setInFlight: (inFlight: boolean) => set({ inFlight }),

  setLastUsedPackage: (lastUsedPackage: string | null) => set({ lastUsedPackage }),

  setCooldown: (seconds: number) => {
    const cooldownUntil = Date.now() + seconds * 1000;
    set({ cooldownUntil });
  },

  startLeg: (index: number) => {
    const legs = [...get().legs];
    const target = legs[index];
    if (target) {
      target.status = 'in_progress';
      target.attempts += 1;
    }
    set({ legs, inFlight: true });
  },

  completeLeg: (index: number, txnId?: string, approvalRef?: string, raw?: string) => {
    const legs = [...get().legs];
    const target = legs[index];
    if (target) {
      target.status = 'success';
      target.txnId = txnId;
      target.approvalRef = approvalRef;
      target.rawResponse = raw;
      target.completedAt = Date.now();
    }
    // 3 second cooldown per Section 4.5
    const cooldownUntil = Date.now() + 3000;
    set({ legs, inFlight: false, cooldownUntil });
  },

  failLeg: (index: number) => {
    const legs = [...get().legs];
    const target = legs[index];
    if (target) {
      target.status = 'failed';
    }
    set({ legs, inFlight: false });
  },

  markLegUnknown: (index: number, raw?: string) => {
    const legs = [...get().legs];
    const target = legs[index];
    if (target) {
      target.status = 'unknown';
      target.rawResponse = raw;
    }
    set({ legs, inFlight: false });
  },

  resolveUnknownLeg: (index: number, didSucceed: boolean) => {
    const legs = [...get().legs];
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
  },

  resetSession: () => {
    set({ ...initialSession });
  },
}));

// Derived selectors (never stored in state per Section 8)
export const selectPaidPaise = (state: Session): number =>
  state.legs
    .filter((leg) => leg.status === 'success')
    .reduce((sum, leg) => sum + leg.amountPaise, 0);

export const selectRemainingPaise = (state: Session): number =>
  state.totalPaise - selectPaidPaise(state);

export const selectDoneCount = (state: Session): number =>
  state.legs.filter((leg) => leg.status === 'success').length;

export const selectTotalCount = (state: Session): number => state.legs.length;

export const selectNextPendingLeg = (state: Session): Leg | undefined =>
  state.legs.find((leg) => leg.status === 'pending' || leg.status === 'failed');
