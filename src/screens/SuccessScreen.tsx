import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { realUpiIntent } from '../native/upiIntent';
import { useHistoryStore } from '../store/historyStore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { RootStackParamList } from '../types';
import {
  useSessionStore,
  selectPaidPaise,
  selectRemainingPaise,
  selectDoneCount,
  selectTotalCount,
} from '../store/sessionStore';
import { maskVpa } from '../domain/upi';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { formatIndianCurrency } from '../components/AmountText';
import { CustomModal, CustomModalButton } from '../components/CustomModal';
import { AppIcon } from '../components/AppIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'Success'>;

type ThemedDialogState = {
  visible: boolean;
  icon?: string;
  iconType?: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  message?: string;
  primaryButton?: CustomModalButton;
  secondaryButton?: CustomModalButton;
};

/**
 * Payment Success / Final Summary Screen.
 * Implements Section 4.6 of AGENTS.md:
 * - Status glyph: Green check for fully settled, amber alert for partial settlements.
 * - Total amount settled, timestamp, payee masked VPA.
 * - Transaction settlement ledger rendered conditionally for split payments.
 * - Official offline receipt generation and saving directly to device storage.
 * - Automatically registers batch in Transaction History on mount.
 * - Clean session reset when tapping Done.
 */
export const SuccessScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const partial = route?.params?.partial ?? false;

  const session = useSessionStore();
  const resetSession = useSessionStore((state) => state.resetSession);

  const [dialog, setDialog] = useState<ThemedDialogState>({ visible: false, title: '' });
  const showThemedDialog = (config: Omit<ThemedDialogState, 'visible'>) => {
    setDialog({ ...config, visible: true });
  };
  const closeDialog = () => setDialog((prev) => ({ ...prev, visible: false }));

  const paidPaise = selectPaidPaise(session);
  const remainingPaise = selectRemainingPaise(session);
  const doneCount = selectDoneCount(session);
  const totalCount = selectTotalCount(session);

  const isFullyPaid = !partial && remainingPaise <= 0;
  const successfulLegs = useMemo(
    () => session?.legs?.filter((leg) => leg?.status === 'success') ?? [],
    [session?.legs]
  );

  const paidFormatted = formatIndianCurrency(paidPaise);
  const remainingFormatted = formatIndianCurrency(remainingPaise);
  const formattedDate = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const hasRecordedRef = useRef(false);

  // Record batch in Transaction History on mount
  useEffect(() => {
    if (hasRecordedRef.current) return;
    try {
      if (paidPaise > 0 && session?.payeeVpa) {
        hasRecordedRef.current = true;
        useHistoryStore.getState()?.addRecord?.({
          id: `txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          payeeName: session?.payeeName || 'Merchant',
          payeeVpa: session?.payeeVpa,
          totalPaise: paidPaise,
          mode: session?.mode ?? 'direct',
          status: isFullyPaid ? 'SUCCESS' : 'PARTIAL',
          timestamp: Date.now(),
          legs: successfulLegs,
          firstTxnId: successfulLegs[0]?.txnId,
          primaryAppLabel: successfulLegs[0]?.appLabel || 'UPI App',
        });
      }
    } catch (err: unknown) {
      console.warn('[SuccessScreen] Failed to record transaction in history:', err);
    }
  }, [isFullyPaid, paidPaise, session?.mode, session?.payeeName, session?.payeeVpa, successfulLegs]);

  const handleDone = () => {
    try {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
      });
    } catch (err: unknown) {
      console.debug?.('[SuccessScreen] Haptic error:', err);
    }

    try {
      resetSession?.();
      navigation?.reset?.({
        index: 0,
        routes: [{ name: 'Scanner' }],
      });
    } catch (err: unknown) {
      console.warn('[SuccessScreen] handleDone navigation error:', err);
    }
  };

  const handleSaveReceipt = async () => {
    try {
      if (Platform.OS === 'android') {
        const androidVersion =
          typeof Platform.Version === 'number'
            ? Platform.Version
            : parseInt(Platform.Version as string, 10);
        if (androidVersion <= 28) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
              title: 'Storage Permission Required',
              message:
                'NoFeePe requires storage access to save the receipt to your gallery.',
              buttonPositive: 'Allow',
            }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            showThemedDialog({
              iconType: 'warning',
              title: 'Permission Denied',
              message: 'Storage permission is required to save receipts on this Android version.',
              primaryButton: { text: 'Got It', onPress: closeDialog },
            });
            return;
          }
        }
      }

      await realUpiIntent?.saveReceipt?.({
        title: isFullyPaid ? 'Payment Successful' : 'Partial Payment Completed',
        amount: `₹${paidFormatted.rupeePart}.${paidFormatted.decimalPart}`,
        payeeName: session?.payeeName || 'Merchant',
        payeeVpa: maskVpa(session?.payeeVpa ?? ''),
        date: formattedDate,
        txnRef:
          successfulLegs[0]?.txnId ||
          successfulLegs[0]?.approvalRef ||
          `NFP_PAY_${Date.now()}`,
        status: isFullyPaid ? 'SUCCESS' : 'PARTIAL',
      });

      showThemedDialog({
        iconType: 'success',
        title: 'Receipt Saved',
        message: 'The official payment receipt image has been saved to your gallery under Pictures/NoFeePe.',
        primaryButton: { text: 'Awesome', onPress: closeDialog },
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unable to save receipt image.';
      showThemedDialog({
        iconType: 'danger',
        title: 'Save Failed',
        message: errMsg,
        primaryButton: { text: 'Dismiss', onPress: closeDialog },
      });
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.sm,
          paddingBottom: Math.max(insets.bottom, 16) + spacing.xs,
        },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Status Glyph and Header */}
        <View style={styles.statusSection}>
          <View
            style={[
              styles.glyphContainer,
              isFullyPaid ? styles.glyphSuccess : styles.glyphPartial,
            ]}
          >
            {isFullyPaid ? (
              <AppIcon name="check" size={32} color="#00E676" />
            ) : (
              <AppIcon name="warning" size={30} color="#F59E0B" />
            )}
          </View>
          <Text style={styles.statusTitle}>
            {isFullyPaid ? 'Payment Complete' : 'Partially Paid'}
          </Text>
          <Text style={styles.statusSubtitle}>
            {isFullyPaid
              ? 'All instalments settled with zero MDR.'
              : 'Payment session stopped before all legs completed.'}
          </Text>
        </View>

        {/* Primary Receipt Summary Card */}
        <GlassCard elevated style={styles.receiptCard}>
          {/* Official Branded Receipt Header */}
          <View style={styles.receiptBrandRow}>
            <View style={styles.receiptBrandLeft}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.receiptBrandLogo}
                resizeMode="contain"
              />
              <Text style={styles.receiptBrandTitle}>NoFee<Text style={styles.receiptBrandAccent}>Pe</Text></Text>
            </View>
            <View style={styles.receiptVerifiedPill}>
              <AppIcon name="lock" size={10} color="#00E676" />
              <Text style={styles.receiptVerifiedText}>VERIFIED</Text>
            </View>
          </View>
          <View style={styles.receiptBrandDivider} />

          <Text style={styles.receiptHeader}>TOTAL AMOUNT PAID</Text>
          <View style={styles.amountDisplay}>
            <Text style={styles.currencySymbol}>₹</Text>
            <Text style={styles.amountNumber}>{paidFormatted.rupeePart}</Text>
            <Text style={styles.amountDecimals}>.{paidFormatted.decimalPart}</Text>
          </View>

          {/* Surcharge Saved Callout Badge */}
          <View style={styles.surchargeBadge}>
            <Text style={styles.surchargeBadgeText}>
              Zero MDR Applied
            </Text>
          </View>

          {/* Meta Details Grid */}
          <View style={styles.divider} />
          <View style={styles.metaGrid}>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payee</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {session?.payeeName || 'Merchant'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>UPI ID</Text>
              <Text style={styles.metaValueMonospace}>
                {maskVpa(session?.payeeVpa ?? '')}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payments Completed</Text>
              <Text style={styles.metaValue}>
                {doneCount} of {totalCount}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Settled At</Text>
              <Text style={styles.metaValue}>{formattedDate}</Text>
            </View>
          </View>
        </GlassCard>

        {/* Partial State Banner */}
        {partial && remainingPaise > 0 && (
          <GlassCard style={styles.partialCard}>
            <Text style={styles.partialTitle}>Payment Incomplete</Text>
            <Text style={styles.partialMessage}>
              ₹{remainingFormatted.rupeePart}.{remainingFormatted.decimalPart} remains unpaid.
              Completed instalments are final and cannot be reversed by NoFeePe.
              You can scan the merchant's QR again to settle the remaining balance.
            </Text>
          </GlassCard>
        )}

        {/* Ledger: Full List of Successful Transactions */}
        {successfulLegs.length > 0 && (
          <View style={styles.ledgerSection}>
            <Text style={styles.ledgerHeading}>SETTLED TRANSACTIONS</Text>
            {successfulLegs.map((leg, idx) => {
              const legAmt = formatIndianCurrency(leg?.amountPaise ?? 0);
              return (
                <GlassCard key={leg?.index ?? idx} style={styles.ledgerItem}>
                  <View style={styles.ledgerHeader}>
                    <Text style={styles.ledgerIndex}>
                      Payment {(leg?.index ?? idx) + 1}
                    </Text>
                    <Text style={styles.ledgerAmount}>
                      ₹{legAmt.rupeePart}.{legAmt.decimalPart}
                    </Text>
                  </View>
                  <View style={styles.ledgerMeta}>
                    <Text style={styles.ledgerRef} numberOfLines={1}>
                      {leg?.txnId ? `UTR: ${leg.txnId}` : 'Settled via UPI'}
                      {leg?.approvalRef ? ` • Appr: ${leg.approvalRef}` : ''}
                    </Text>
                    <View style={styles.ledgerStatusBadge}>
                      <AppIcon name="check" size={10} color="#00F5A0" />
                      <Text style={styles.ledgerStatus}>Settled</Text>
                    </View>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Footer Controls */}
      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleSaveReceipt}
          style={styles.saveButton}
        >
          <AppIcon name="download" size={16} color="#FFFFFF" />
          <Text style={styles.saveButtonText}>Save Receipt to Gallery</Text>
        </TouchableOpacity>

        <GradientButton
          label="Done"
          onPress={handleDone}
          variant="primary"
        />
      </View>

      {/* Themed Custom Modal */}
      <CustomModal
        visible={dialog.visible}
        icon={dialog.icon}
        iconType={dialog.iconType}
        title={dialog.title}
        message={dialog.message}
        primaryButton={dialog.primaryButton}
        secondaryButton={dialog.secondaryButton}
        onDismiss={closeDialog}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070B',
    paddingHorizontal: spacing.md,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  statusSection: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  glyphContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  glyphSuccess: {
    backgroundColor: 'rgba(0, 245, 160, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(0, 245, 160, 0.4)',
  },
  glyphPartial: {
    backgroundColor: 'rgba(255, 176, 32, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(255, 176, 32, 0.4)',
  },
  glyphText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statusTitle: {
    ...typography.headingLg,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  statusSubtitle: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    textAlign: 'center',
    maxWidth: 280,
  },
  receiptCard: {
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  receiptBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  receiptBrandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  receiptBrandLogo: {
    width: 22,
    height: 22,
    borderRadius: 6,
  },
  receiptBrandTitle: {
    ...typography.headingSm,
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  receiptBrandAccent: {
    color: '#00D9F5',
  },
  receiptVerifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 3,
    borderRadius: radii?.pill ?? 9999,
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.25)',
  },
  receiptVerifiedText: {
    ...typography.pillLabel,
    fontSize: 9,
    fontWeight: '800',
    color: '#00E676',
    letterSpacing: 0.6,
  },
  receiptBrandDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  receiptHeader: {
    ...typography.captionMedium,
    color: colors?.textMuted ?? '#8E92A8',
    letterSpacing: 1.2,
    fontSize: 11,
    textAlign: 'center',
  },
  amountDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  currencySymbol: {
    ...typography.currencyDisplay,
    fontSize: 28,
    color: colors?.textMuted ?? '#8E92A8',
    marginRight: 4,
  },
  amountNumber: {
    ...typography.currencyDisplay,
    fontSize: 44,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '800',
  },
  amountDecimals: {
    ...typography.currencyDisplay,
    fontSize: 28,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
  },
  detailLabel: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 13,
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    maxWidth: 180,
  },
  monoValue: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  partialCard: {
    padding: spacing.md,
    backgroundColor: 'rgba(255, 176, 32, 0.06)',
    borderColor: 'rgba(255, 176, 32, 0.25)',
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  partialTitle: {
    ...typography.captionMedium,
    color: colors?.warning ?? '#FFB020',
    letterSpacing: 1,
    fontSize: 11,
  },
  partialAmount: {
    ...typography.headingSm,
    color: colors?.warning ?? '#FFB020',
    fontWeight: '800',
    marginVertical: 4,
  },
  partialNote: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    lineHeight: 18,
  },
  ledgerSection: {
    gap: spacing.sm,
  },
  ledgerTitle: {
    ...typography.captionMedium,
    color: colors?.textMuted ?? '#8E92A8',
    letterSpacing: 1.2,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  ledgerItem: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  ledgerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ledgerIndex: {
    ...typography.caption,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
  },
  ledgerAmount: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
  },
  ledgerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  surchargeBadge: {
    alignSelf: 'center',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 245, 160, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.2)',
    marginTop: spacing.xs,
  },
  surchargeBadgeText: {
    ...typography.caption,
    color: colors?.accentStart ?? '#00F5A0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  metaGrid: {
    gap: spacing.xs + 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  metaLabel: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 13,
  },
  metaValue: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    maxWidth: 180,
  },
  metaValueMonospace: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  partialMessage: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    lineHeight: 18,
    marginTop: 4,
  },
  ledgerHeading: {
    ...typography.captionMedium,
    color: colors?.textMuted ?? '#8E92A8',
    letterSpacing: 1.2,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  ledgerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ledgerRef: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    fontFamily: 'monospace',
    fontSize: 11,
    flex: 1,
    marginRight: spacing.sm,
  },
  ledgerStatus: {
    ...typography.caption,
    color: colors?.success ?? '#00E676',
    fontWeight: '600',
    fontSize: 11,
  },
  footer: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  saveButton: {
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radii?.button ?? 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButtonText: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
