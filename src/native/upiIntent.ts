import { NativeModules, Platform, Linking } from 'react-native';
import { UpiAppInfo, UpiPaymentResult } from '../types';
import { KNOWN_UPI_APPS } from './registry';

export interface IUpiIntentService {
  listUpiApps(): Promise<UpiAppInfo[]>;
  pay(uri: string, packageName: string): Promise<UpiPaymentResult>;
}

const { UpiIntent } = NativeModules;

class RealUpiIntentService implements IUpiIntentService {
  async listUpiApps(): Promise<UpiAppInfo[]> {
    if (Platform.OS === 'android') {
      if (!UpiIntent || !UpiIntent.listUpiApps) {
        throw new Error('UpiIntent native module is not linked.');
      }
      const rawApps: { packageName: string; label: string }[] = await UpiIntent.listUpiApps();
      return rawApps.map((app) => {
        const known = KNOWN_UPI_APPS[app.packageName];
        return {
          packageName: app.packageName,
          label: known ? known.name : app.label,
          brandColor: known ? known.brand : undefined,
        };
      });
    } else {
      // iOS fallback per Section 10
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
        } catch {
          // ignore error check
        }
      }
      return available;
    }
  }

  async pay(uri: string, packageName: string): Promise<UpiPaymentResult> {
    if (Platform.OS === 'android') {
      if (!UpiIntent || !UpiIntent.pay) {
        throw new Error('UpiIntent native module is not linked.');
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
  }
}

export type MockOutcomeSequence = ('SUCCESS' | 'FAILURE' | 'PENDING' | 'CANCELLED' | 'UNKNOWN')[];

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
    // Simulate intent transition delay
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 800));

    const outcome = this.scriptedOutcomes[this.callCount % this.scriptedOutcomes.length];
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
}

export const realUpiIntent = new RealUpiIntentService();
export const mockUpiIntent = new MockUpiIntentService();

let useMock = __DEV__; // Defaults to mock in development if native module not linked

export const isMockEnabled = () => useMock;
export const setMockEnabled = (enabled: boolean) => {
  useMock = enabled;
};

export const getUpiIntent = (): IUpiIntentService => {
  if (useMock || !UpiIntent) {
    return mockUpiIntent;
  }
  return realUpiIntent;
};
