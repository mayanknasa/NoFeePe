export type LegStatus = 'pending' | 'in_progress' | 'success' | 'failed' | 'unknown';

export type Leg = {
  index: number;
  amountPaise: number;
  status: LegStatus;
  attempts: number;
  txnId?: string;
  approvalRef?: string;
  completedAt?: number;
  rawResponse?: string;
};

export type PaymentMode = 'direct' | 'split';

export type Session = {
  payeeVpa: string; // immutable once set
  payeeName: string | null;
  merchantCode: string | null;
  transactionNote: string | null;
  signature: string | null;
  totalPaise: number;
  mode: PaymentMode;
  legs: Leg[];
  lastUsedPackage: string | null;
  inFlight: boolean;
  cooldownUntil: number | null;
};

export type UpiAppInfo = {
  packageName: string;
  label: string;
  brandColor?: string;
};

export type UpiPaymentResult = {
  status: 'SUCCESS' | 'PENDING' | 'FAILURE' | 'CANCELLED' | 'UNKNOWN';
  txnId: string;
  txnRef: string;
  approvalRef: string;
  raw: string;
};

export type RootStackParamList = {
  Splash: undefined;
  Scanner: undefined;
  Amount: {
    payeeVpa: string;
    payeeName?: string | null;
    fixedAmountPaise?: number | null;
    merchantCode?: string | null;
    signature?: string | null;
    transactionNote?: string | null;
  };
  Method: undefined;
  Pay: undefined;
  Success: {
    partial?: boolean;
  };
};
