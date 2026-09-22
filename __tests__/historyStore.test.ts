import { useHistoryStore } from '../src/store/historyStore';

describe('History Store', () => {
  beforeEach(() => {
    useHistoryStore.getState().clearHistory();
  });

  test('Adds and retrieves transaction records', () => {
    expect(useHistoryStore.getState().records).toEqual([]);

    useHistoryStore.getState().addRecord({
      id: 'txn_test_1',
      payeeName: 'Sharma Electronics',
      payeeVpa: 'sharma@okhdfcbank',
      totalPaise: 500000,
      mode: 'split',
      status: 'SUCCESS',
      timestamp: 1700000000000,
      legs: [
        { index: 0, amountPaise: 199900, status: 'success', attempts: 1, txnId: 'T1' },
        { index: 1, amountPaise: 199900, status: 'success', attempts: 1, txnId: 'T2' },
        { index: 2, amountPaise: 100200, status: 'success', attempts: 1, txnId: 'T3' },
      ],
      firstTxnId: 'T1',
    });

    const records = useHistoryStore.getState().records;
    expect(records.length).toBe(1);
    expect(records[0].payeeName).toBe('Sharma Electronics');
    expect(records[0].totalPaise).toBe(500000);
    expect(records[0].status).toBe('SUCCESS');
  });

  test('Clears transaction records', () => {
    useHistoryStore.getState().addRecord({
      id: 'txn_test_2',
      payeeName: 'Grocery Store',
      payeeVpa: 'grocery@upi',
      totalPaise: 200000,
      mode: 'direct',
      status: 'SUCCESS',
      timestamp: 1700000001000,
      legs: [],
    });

    expect(useHistoryStore.getState().records.length).toBe(1);
    useHistoryStore.getState().clearHistory();
    expect(useHistoryStore.getState().records.length).toBe(0);
  });
});
