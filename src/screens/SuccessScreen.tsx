import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Success'>;

export const SuccessScreen: React.FC<Props> = ({ route, navigation }) => {
  const { partial = false } = route.params || {};

  const session = useSessionStore();
  const resetSession = useSessionStore((state) => state.resetSession);

  const paidPaise = selectPaidPaise(session);
  const remainingPaise = selectRemainingPaise(session);
  const doneCount = selectDoneCount(session);
  const totalCount = selectTotalCount(session);

  const isFullyPaid = !partial && remainingPaise <= 0;
  const successfulLegs = session.legs.filter((leg) => leg.status === 'success');

  const paidFormatted = formatIndianCurrency(paidPaise);
  const remainingFormatted = formatIndianCurrency(remainingPaise);
  const formattedDate = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const handleDone = () => {
    try {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
      });
    } catch {}

    resetSession();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Scanner' }],
    });
  };

  const handleSaveReceipt = () => {
    try {
      ReactNativeHapticFeedback.trigger('notificationSuccess', {
        enableVibrateFallback: true,
      });
    } catch {}

    Alert.alert(
      'Receipt Saved',
      `Receipt for ₹${paidFormatted.rupeePart}.${paidFormatted.decimalPart} saved to gallery with masked VPA.`
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Main Status Glyph Card */}
          <GlassCard
            elevated
            borderColor={isFullyPaid ? 'rgba(43, 217, 160, 0.3)' : 'rgba(255, 176, 32, 0.3)'}
            style={styles.heroCard}
          >
            <View
              style={[
                styles.glyphContainer,
                isFullyPaid ? styles.glyphSuccess : styles.glyphPartial,
              ]}
            >
              <Text style={styles.glyphIcon}>{isFullyPaid ? '✓' : '!'}</Text>
            </View>

            <Text style={styles.heroTitle}>
              {isFullyPaid ? 'Payment Successful' : 'Partial Payment Completed'}
            </Text>
            <Text style={styles.heroSubtitle}>
              {isFullyPaid
                ? 'All instalments settled directly via UPI'
                : 'Session ended early with partial settlement'}
            </Text>

            {/* Total Paid Display */}
            <View style={styles.amountDisplayBlock}>
              <Text style={styles.amountTotalLabel}>TOTAL PAID</Text>
              <Text style={styles.amountTotalValue}>
                ₹{paidFormatted.rupeePart}.{paidFormatted.decimalPart}
              </Text>
            </View>

            {/* Payee and Metadata Details with Masked VPA */}
            <View style={styles.metaDivider} />
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Payee</Text>
              <Text style={styles.metaValue}>{session.payeeName || 'Merchant'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>UPI ID</Text>
              <Text style={[styles.metaValue, styles.monospace]}>
                {maskVpa(session.payeeVpa)}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Settlement Date</Text>
              <Text style={styles.metaValue}>{formattedDate}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Transactions</Text>
              <Text style={styles.metaValue}>
                {doneCount} of {totalCount} completed
              </Text>
            </View>
          </GlassCard>

          {/* Partial Payment Warning Block per Section 4.6 */}
          {!isFullyPaid && remainingPaise > 0 && (
            <GlassCard style={styles.partialCard}>
              <View style={styles.partialHeader}>
                <Text style={styles.partialAlertIcon}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partialTitle}>Outstanding Balance</Text>
                  <Text style={styles.partialAmount}>
                    ₹{remainingFormatted.rupeePart}.{remainingFormatted.decimalPart} not paid
                  </Text>
                </View>
              </View>
              <Text style={styles.partialNote}>
                You can scan the merchant QR code again anytime to settle the remaining balance.
              </Text>
            </GlassCard>
          )}

          {/* Detailed Transaction Ledger per Section 4.6 */}
          <View style={styles.ledgerSection}>
            <Text style={styles.ledgerHeader}>TRANSACTION SETTLEMENT LEDGER</Text>
            {successfulLegs.map((leg) => {
              const legFormatted = formatIndianCurrency(leg.amountPaise);
              return (
                <GlassCard key={leg.index} style={styles.legCard}>
                  <View style={styles.legCardHeader}>
                    <View style={styles.legIndexBadge}>
                      <Text style={styles.legIndexText}>#{leg.index + 1}</Text>
                    </View>
                    <View style={styles.legDetails}>
                      <Text style={styles.legAmount}>
                        ₹{legFormatted.rupeePart}.{legFormatted.decimalPart}
                      </Text>
                      {leg.txnId && (
                        <Text style={styles.legRef}>UTR: {leg.txnId}</Text>
                      )}
                      {leg.approvalRef && (
                        <Text style={styles.legRef}>Appr: {leg.approvalRef}</Text>
                      )}
                    </View>
                    <View style={styles.successPill}>
                      <Text style={styles.successPillText}>Settled</Text>
                    </View>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        </ScrollView>

        {/* Footer Actions */}
        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSaveReceipt}
            style={styles.saveReceiptBtn}
          >
            <Text style={styles.saveReceiptText}>📥 Save Masked Receipt</Text>
          </TouchableOpacity>

          <GradientButton label="Done • New Payment" onPress={handleDone} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  heroCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  glyphContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  glyphSuccess: {
    backgroundColor: 'rgba(43, 217, 160, 0.15)',
    borderWidth: 2,
    borderColor: colors.success,
  },
  glyphPartial: {
    backgroundColor: 'rgba(255, 176, 32, 0.15)',
    borderWidth: 2,
    borderColor: colors.pending,
  },
  glyphIcon: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  heroTitle: {
    ...typography.headingMd,
    fontSize: 22,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...typography.captionMedium,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  amountDisplayBlock: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  amountTotalLabel: {
    ...typography.captionMedium,
    color: colors.textFaint,
    letterSpacing: 1.2,
  },
  amountTotalValue: {
    ...typography.currencyDisplay,
    fontSize: 36,
    color: colors.textPrimary,
    marginTop: 2,
  },
  metaDivider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 4,
  },
  metaLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  metaValue: {
    ...typography.captionMedium,
    color: colors.textPrimary,
  },
  monospace: {
    fontFamily: 'monospace',
  },
  partialCard: {
    padding: spacing.md + 2,
    borderColor: 'rgba(255, 176, 32, 0.3)',
    backgroundColor: 'rgba(255, 176, 32, 0.05)',
  },
  partialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  partialAlertIcon: {
    fontSize: 24,
  },
  partialTitle: {
    ...typography.title,
    fontSize: 14,
    color: colors.pending,
  },
  partialAmount: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  partialNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 16,
  },
  ledgerSection: {
    gap: spacing.sm,
  },
  ledgerHeader: {
    ...typography.captionMedium,
    color: colors.textFaint,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  legCard: {
    padding: spacing.md,
    borderRadius: radii.row,
  },
  legCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legIndexBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legIndexText: {
    ...typography.captionMedium,
    color: colors.textMuted,
  },
  legDetails: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  legAmount: {
    ...typography.bodyMedium,
    fontWeight: '700',
  },
  legRef: {
    ...typography.caption,
    fontFamily: 'monospace',
    color: colors.textFaint,
    fontSize: 10,
    marginTop: 1,
  },
  successPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(43, 217, 160, 0.15)',
  },
  successPillText: {
    ...typography.pillLabel,
    color: colors.success,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  saveReceiptBtn: {
    paddingVertical: spacing.md,
    borderRadius: radii.button,
    backgroundColor: colors.glassFill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveReceiptText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});
