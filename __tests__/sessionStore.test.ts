import {
  useSessionStore,
  selectPaidPaise,
  selectRemainingPaise,
  selectDoneCount,
  selectTotalCount,
  selectNextPendingLeg,
} from '../src/store/sessionStore';

describe('Zustand Session Store (Section 8)', () => {
  beforeEach(() => {
    useSessionStore.getState().resetSession();
  });

  test('Initializes session and computes selectors properly', () => {
    useSessionStore.getState().initSession({
      payeeVpa: 'sharma@okhdfcbank',
      payeeName: 'Sharma Electronics',
      merchantCode: '5411',
      transactionNote: 'Bill 123',
      signature: null,
      totalPaise: 1000000, // Rs 10,000
      mode: 'split',
      legs: [199900, 199900, 199900, 199900, 199900, 500],
    });

    const state = useSessionStore.getState();
    expect(state.payeeVpa).toBe('sharma@okhdfcbank');
    expect(state.totalPaise).toBe(1000000);
    expect(state.legs.length).toBe(6);
    expect(selectTotalCount(state)).toBe(6);
    expect(selectDoneCount(state)).toBe(0);
    expect(selectPaidPaise(state)).toBe(0);
    expect(selectRemainingPaise(state)).toBe(1000000);
    expect(selectNextPendingLeg(state)?.index).toBe(0);
  });

  test('Leg progression and cooldown calculation', () => {
    useSessionStore.getState().initSession({
      payeeVpa: 'sharma@okhdfcbank',
      payeeName: 'Sharma Electronics',
      merchantCode: null,
      transactionNote: null,
      signature: null,
      totalPaise: 400000,
      mode: 'split',
      legs: [199900, 199900, 200],
    });

    // Start leg 0
    useSessionStore.getState().startLeg(0);
    let state = useSessionStore.getState();
    expect(state.inFlight).toBe(true);
    expect(state.legs[0].status).toBe('in_progress');
    expect(state.legs[0].attempts).toBe(1);

    // Complete leg 0
    useSessionStore.getState().completeLeg(0, 'TXN123', 'APPR456');
    state = useSessionStore.getState();
    expect(state.inFlight).toBe(false);
    expect(state.legs[0].status).toBe('success');
    expect(state.legs[0].txnId).toBe('TXN123');
    expect(selectPaidPaise(state)).toBe(199900);
    expect(selectRemainingPaise(state)).toBe(200100);
    expect(selectDoneCount(state)).toBe(1);
    expect(selectNextPendingLeg(state)?.index).toBe(1);

    // Cooldown is set ~3000ms ahead
    expect(state.cooldownUntil).toBeGreaterThan(Date.now() + 2000);
  });

  test('Handles failed leg and unknown resolution', () => {
    useSessionStore.getState().initSession({
      payeeVpa: 'merchant@upi',
      payeeName: null,
      merchantCode: null,
      transactionNote: null,
      signature: null,
      totalPaise: 200000,
      mode: 'split',
      legs: [199900, 100],
    });

    useSessionStore.getState().startLeg(0);
    useSessionStore.getState().failLeg(0);
    let state = useSessionStore.getState();
    expect(state.legs[0].status).toBe('failed');
    expect(state.inFlight).toBe(false);
    // Next pending leg should be leg 0 for retry
    expect(selectNextPendingLeg(state)?.index).toBe(0);

    // Leg 1 marked unknown
    useSessionStore.getState().startLeg(1);
    useSessionStore.getState().markLegUnknown(1, 'status=PENDING');
    state = useSessionStore.getState();
    expect(state.legs[1].status).toBe('unknown');

    // User confirms leg went through
    useSessionStore.getState().resolveUnknownLeg(1, true);
    state = useSessionStore.getState();
    expect(state.legs[1].status).toBe('success');
  });
});
