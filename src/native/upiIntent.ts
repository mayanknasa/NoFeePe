import { NativeModules, Platform, Linking } from 'react-native';
import { UpiAppInfo, UpiPaymentResult } from '../types';
import { KNOWN_UPI_APPS } from './registry';

/**
 * Receipt metadata payload for native Android Canvas generation.
 */
export interface ReceiptDetails {
  title?: string;
  amount: string;
  payeeName: string;
  payeeVpa: string;
  date: string;
  txnRef?: string;
  status?: string;
}

/**
 * Interface contract for UPI Intent operations.
 */
export interface IUpiIntentService {
  listUpiApps(): Promise<UpiAppInfo[]>;
  pay(uri: string, packageName: string): Promise<UpiPaymentResult>;
  scanQr?(uri: string): Promise<string>;
  saveReceipt?(details: ReceiptDetails): Promise<string>;
  saveHistory?(json: string): Promise<boolean>;
  getHistory?(): Promise<string>;
}

const { UpiIntent } = NativeModules;

/**
 * Production implementation bridging to native Android Kotlin module.
 */
class RealUpiIntentService implements IUpiIntentService {
  /**
   * Queries the Android PackageManager for all activities responding to upi://pay.
   * Uses package visibility <queries> declared in AndroidManifest.xml.
   */
  async listUpiApps(): Promise<UpiAppInfo[]> {
    try {
      if (Platform.OS === 'android') {
        if (!UpiIntent?.listUpiApps) {
          return mockUpiIntent.listUpiApps();
        }
        const rawApps: { packageName: string; label: string; iconBase64?: string }[] =
          await UpiIntent.listUpiApps();

        return (rawApps ?? []).map((app) => {
          const known = KNOWN_UPI_APPS[app?.packageName];
          return {
            packageName: app?.packageName ?? '',
            label: known?.name ?? app?.label ?? 'UPI App',
            brandColor: known?.brand,
            iconBase64: app?.iconBase64,
          };
        });
      } else {
        // iOS fallback: check supported custom URL schemes per Section 10
        const supportedSchemes = [
          { scheme: 'phonepe://', pkg: 'com.phonepe.app', name: 'PhonePe' },
          { scheme: 'tez://', pkg: 'com.google.android.apps.nbu.paisa.user', name: 'Google Pay' },
          { scheme: 'paytmmp://', pkg: 'net.one97.paytm', name: 'Paytm' },
          { scheme: 'bhim://', pkg: 'in.org.npci.upiapp', name: 'BHIM' },
          { scheme: 'credpay://', pkg: 'com.dreamplug.androidapp', name: 'CRED' },
          { scheme: 'amazonpay://', pkg: 'in.amazon.mShop.android.shopping', name: 'Amazon Pay' },
        ];

        const available: UpiAppInfo[] = [];
        for (const item of supportedSchemes) {
          try {
            const can = await Linking.canOpenURL(item.scheme);
            if (can) {
              const known = KNOWN_UPI_APPS[item.pkg];
              available.push({
                packageName: item.pkg,
                label: item.name,
                brandColor: known?.brand,
              });
            }
          } catch (err: unknown) {
            console.warn('[UpiIntent] Linking.canOpenURL failed for scheme:', item.scheme, err);
          }
        }
        return available;
      }
    } catch (err: unknown) {
      console.warn('[UpiIntent] listUpiApps error:', err);
      return [];
    }
  }

  /**
   * Dispatches the UPI payment intent with FLAG_ACTIVITY_NO_HISTORY.
   */
  async pay(uri: string, packageName: string): Promise<UpiPaymentResult> {
    try {
      if (Platform.OS === 'android') {
        if (!UpiIntent?.pay) {
          return mockUpiIntent.pay(uri, packageName);
        }
        return await UpiIntent.pay(uri, packageName);
      } else {
        // iOS handling per Section 10:
        // Launch with Linking.openURL, always resolve as UNKNOWN requiring user confirmation.
        await Linking.openURL(uri);
        return {
          status: 'UNKNOWN',
          txnId: '',
          txnRef: '',
          approvalRef: '',
          raw: 'iOS_UNKNOWN_CALLBACK',
        };
      }
    } catch (err: unknown) {
      console.warn('[UpiIntent] pay error:', err);
      throw err;
    }
  }

  /**
   * Scans a static image file for QR codes using Google ML Kit.
   */
  async scanQr(uri: string): Promise<string> {
    try {
      if (Platform.OS === 'android' && UpiIntent?.scanQr) {
        return await UpiIntent.scanQr(uri);
      }
      throw new Error('Native QR scan is only available on Android.');
    } catch (err: unknown) {
      console.warn('[UpiIntent] scanQr error:', err);
      throw err;
    }
  }

  /**
   * Renders and saves an official receipt to the device gallery using Android MediaStore.
   */
  async saveReceipt(details: ReceiptDetails): Promise<string> {
    try {
      if (Platform.OS === 'android' && UpiIntent?.saveReceipt) {
        return await UpiIntent.saveReceipt(details);
      }
      throw new Error('Native receipt save is only available on Android.');
    } catch (err: unknown) {
      console.warn('[UpiIntent] saveReceipt error:', err);
      throw err;
    }
  }

  /**
   * Persists transaction records in Android SharedPreferences.
   */
  async saveHistory(json: string): Promise<boolean> {
    try {
      if (Platform.OS === 'android' && UpiIntent?.saveHistoryJson) {
        return await UpiIntent.saveHistoryJson(json);
      }
      return false;
    } catch (err: unknown) {
      console.warn('[UpiIntent] saveHistory error:', err);
      return false;
    }
  }

  /**
   * Retrieves persisted transaction records from Android SharedPreferences.
   */
  async getHistory(): Promise<string> {
    try {
      if (Platform.OS === 'android' && UpiIntent?.getHistoryJson) {
        return await UpiIntent.getHistoryJson();
      }
      return '[]';
    } catch (err: unknown) {
      console.warn('[UpiIntent] getHistory error:', err);
      return '[]';
    }
  }
}

export type MockOutcomeSequence = ('SUCCESS' | 'FAILURE' | 'PENDING' | 'CANCELLED' | 'UNKNOWN')[];

/**
 * Mock implementation used during unit tests and simulator environments.
 */
class MockUpiIntentService implements IUpiIntentService {
  private scriptedOutcomes: MockOutcomeSequence = ['SUCCESS'];
  private callCount = 0;

  setScriptedOutcomes(outcomes: MockOutcomeSequence) {
    this.scriptedOutcomes = outcomes;
    this.callCount = 0;
  }

  async listUpiApps(): Promise<UpiAppInfo[]> {
    return [
      { packageName: 'com.phonepe.app', label: 'PhonePe', brandColor: '#5F259F' },
      { packageName: 'com.google.android.apps.nbu.paisa.user', label: 'Google Pay', brandColor: '#1A73E8' },
      { packageName: 'net.one97.paytm', label: 'Paytm', brandColor: '#00BAF2' },
      { packageName: 'in.org.npci.upiapp', label: 'BHIM', brandColor: '#F7941D' },
      { packageName: 'com.dreamplug.androidapp', label: 'CRED', brandColor: '#141414' },
      { packageName: 'in.amazon.mShop.android.shopping', label: 'Amazon Pay', brandColor: '#FF9900' },
    ];
  }

  async pay(_uri: string, _packageName: string): Promise<UpiPaymentResult> {
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 800));

    const outcome = this.scriptedOutcomes[this.callCount % this.scriptedOutcomes.length] ?? 'SUCCESS';
    this.callCount++;

    const fakeRef = `UTR${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const fakeApproval = `APPR${Math.floor(100000 + Math.random() * 900000)}`;

    return {
      status: outcome,
      txnId: outcome === 'SUCCESS' ? fakeRef : '',
      txnRef: outcome === 'SUCCESS' ? fakeRef : '',
      approvalRef: outcome === 'SUCCESS' ? fakeApproval : '',
      raw: `status=${outcome}&txnid=${fakeRef}&approvalrefno=${fakeApproval}`,
    };
  }

  async scanQr(_uri: string): Promise<string> {
    throw new Error('Mock QR scanning unavailable.');
  }

  async saveReceipt(_details: ReceiptDetails): Promise<string> {
    return 'mock://receipt-saved.png';
  }

  private mockHistoryStr = '[]';
  async saveHistory(json: string): Promise<boolean> {
    this.mockHistoryStr = json;
    return true;
  }

  async getHistory(): Promise<string> {
    return this.mockHistoryStr;
  }
}

export const realUpiIntent = new RealUpiIntentService();
export const mockUpiIntent = new MockUpiIntentService();

let useMock = false;

export const isMockEnabled = () => useMock;
export const setMockEnabled = (enabled: boolean) => {
  useMock = enabled;
};

export const getUpiIntent = (): IUpiIntentService => {
  if (useMock || (!UpiIntent && Platform.OS !== 'android')) {
    return mockUpiIntent;
  }
  return realUpiIntent;
};
