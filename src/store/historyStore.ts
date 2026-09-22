import { create } from 'zustand';
import { TransactionRecord } from '../types';
import { realUpiIntent } from '../native/upiIntent';

/**
 * State and actions for the Transaction History store.
 * Backed by Android SharedPreferences for lightweight, zero-dependency persistence.
 */
interface HistoryState {
  records: TransactionRecord[];
  isLoaded: boolean;
  loadHistory: () => Promise<void>;
  addRecord: (record: TransactionRecord) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  records: [],
  isLoaded: false,

  loadHistory: async () => {
    try {
      if (realUpiIntent?.getHistory) {
        const json = await realUpiIntent.getHistory();
        if (json && json !== '[]') {
          const parsed = JSON.parse(json);
          if (Array.isArray(parsed)) {
            set({ records: parsed, isLoaded: true });
            return;
          }
        }
      }
    } catch (err: unknown) {
      console.warn('[HistoryStore] Failed to load transaction history:', err);
    }
    set({ isLoaded: true });
  },

  addRecord: (record: TransactionRecord) => {
    try {
      const existing = get()?.records ?? [];
      const updated = [record, ...existing];
      set({ records: updated });
      if (realUpiIntent?.saveHistory) {
        realUpiIntent.saveHistory(JSON.stringify(updated));
      }
    } catch (err: unknown) {
      console.warn('[HistoryStore] Failed to add transaction record:', err);
    }
  },

  clearHistory: () => {
    try {
      set({ records: [] });
      if (realUpiIntent?.saveHistory) {
        realUpiIntent.saveHistory('[]');
      }
    } catch (err: unknown) {
      console.warn('[HistoryStore] Failed to clear transaction history:', err);
    }
  },
}));

// Trigger initial load on app startup
try {
  useHistoryStore.getState()?.loadHistory?.();
} catch (err: unknown) {
  console.warn('[HistoryStore] Initial load invocation failed:', err);
}
