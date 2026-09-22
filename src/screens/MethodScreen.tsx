import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { RootStackParamList, PaymentMode } from '../types';
import { planSplit, SplitError } from '../domain/split';
import { maskVpa } from '../domain/upi';
import { useSessionStore } from '../store/sessionStore';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { BackButton } from '../components/BackButton';
import { formatIndianCurrency } from '../components/AmountText';
import { AppIcon } from '../components/AppIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'Method'>;

/**
 * Payment Method Selection Screen.
 * Implements Section 4.4 of AGENTS.md:
 * - Direct Pay: single transaction for the full amount.
 * - Split & Pay: headline feature dividing transactions > Rs 1,999 into sub-cap installments
 *   (each <= Rs 1,999.00) to eliminate merchant interchange fees.
 * - Live dynamic split preview computed from entered amount.
 * - Collapsible 'What is Split & Pay?' educational explainer.
 */
export const MethodScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const totalPaise = useSessionStore((state) => state.totalPaise);
  const payeeVpa = useSessionStore((state) => state.payeeVpa);
  const payeeName = useSessionStore((state) => state.payeeName);
  const merchantCode = useSessionStore((state) => state.merchantCode);
  const transactionNote = useSessionStore((state) => state.transactionNote);
  const signature = useSessionStore((state) => state.signature);
  const initSession = useSessionStore((state) => state.initSession);

  const isFixedAmount = !!signature && totalPaise > 0;

  // Compute live split preview
  const { splitPlanResult, splitPlanError } = useMemo(() => {
    if (totalPaise <= 199900 || isFixedAmount) {
      return { splitPlanResult: null, splitPlanError: null };
    }
    try {
      return { splitPlanResult: planSplit(totalPaise), splitPlanError: null };
    } catch (err: unknown) {
      return {
        splitPlanResult: null,
        splitPlanError:
          err instanceof SplitError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'Unable to split this amount',
      };
    }
  }, [totalPaise, isFixedAmount]);

  const isSplitEligible = totalPaise > 199900 && !isFixedAmount && !!splitPlanResult;

  const splitPreviewText = useMemo(() => {
    if (!splitPlanResult?.legs) return null;
    try {
      const fullLegCount = splitPlanResult.legs.filter((l) => l === 199900).length;
      const remainderLegs = splitPlanResult.legs.filter((l) => l !== 199900);

      const parts: string[] = [];
      if (fullLegCount > 0) {
        parts.push(`${fullLegCount} x ₹1,999.00`);
      }
      remainderLegs.forEach((r) => {
        parts.push(`₹${((r ?? 0) / 100).toFixed(2)}`);
      });

      return `${splitPlanResult.count} payments: ${parts.join(' + ')}`;
    } catch (err: unknown) {
      console.warn('[MethodScreen] splitPreviewText computation error:', err);
      return null;
    }
  }, [splitPlanResult]);

  const disabledReason = useMemo(() => {
    if (isFixedAmount) {
      return 'This QR has a fixed amount set by the merchant.';
    }
    if (totalPaise <= 199900) {
      return 'Available for bills above Rs 1,999.00';
    }
    if (splitPlanError) {
      return splitPlanError;
    }
    return null;
  }, [isFixedAmount, totalPaise, splitPlanError]);

  // Default mode: split if available, otherwise direct
  const [selectedMode, setSelectedMode] = useState<PaymentMode>(
    isSplitEligible ? 'split' : 'direct'
  );

  useEffect(() => {
    setSelectedMode(isSplitEligible ? 'split' : 'direct');
  }, [isSplitEligible]);

  const [showExplainer, setShowExplainer] = useState(false);

  const handleSelectMode = (mode: PaymentMode) => {
    if (mode === 'split' && !isSplitEligible) return;

    try {
      ReactNativeHapticFeedback.trigger('selection', {
        enableVibrateFallback: true,
      });
    } catch (err: unknown) {
      console.debug?.('[MethodScreen] Haptic error:', err);
    }

    setSelectedMode(mode);
  };

  const handleProceed = () => {
    try {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
      });
    } catch (err: unknown) {
      console.debug?.('[MethodScreen] Haptic error:', err);
    }

    try {
      let legs: number[] = [totalPaise];
      if (selectedMode === 'split' && splitPlanResult?.legs) {
        legs = splitPlanResult.legs;
      }

      // Update session store with finalized mode and legs
      initSession?.({
        payeeVpa: payeeVpa ?? '',
        payeeName: payeeName ?? null,
        merchantCode: merchantCode ?? null,
        transactionNote: transactionNote ?? null,
        signature: signature ?? null,
        totalPaise,
        mode: selectedMode,
        legs,
      });

      // Navigate to Pay screen
      navigation?.navigate?.('Pay');
    } catch (err: unknown) {
      console.warn('[MethodScreen] handleProceed error:', err);
    }
  };

  const totalFormatted = formatIndianCurrency(totalPaise);

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
      {/* Header */}
      <View style={styles.header}>
        <BackButton
          onPress={() => {
            try {
              navigation?.goBack?.();
            } catch (err: unknown) {
              console.warn('[MethodScreen] Back error:', err);
            }
          }}
        />
        <Text style={styles.headerTitle}>Select Method</Text>
        <View style={styles.backPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Total Bill Summary Card */}
        <GlassCard style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL AMOUNT TO PAY</Text>
          <View style={styles.amountDisplay}>
            <Text style={styles.currencySymbol}>₹</Text>
            <Text style={styles.amountNumber}>{totalFormatted.rupeePart}</Text>
            <Text style={styles.amountDecimals}>.{totalFormatted.decimalPart}</Text>
          </View>
          <Text style={styles.payeeSubtext} numberOfLines={1}>
            To: {payeeName || maskVpa(payeeVpa)}
          </Text>
        </GlassCard>

        {/* Method Selection Cards */}
        <View style={styles.cardsContainer}>
          {/* Split & Pay Card */}
          <TouchableOpacity
            activeOpacity={isSplitEligible ? 0.85 : 1}
            onPress={() => handleSelectMode('split')}
            disabled={!isSplitEligible}
          >
            <GlassCard
              elevated={selectedMode === 'split'}
              style={[
                styles.methodCard,
                selectedMode === 'split' && styles.selectedMethodCard,
                !isSplitEligible && styles.disabledMethodCard,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.badgeRow}>
                  <View style={styles.headlinePill}>
                    <Text style={styles.headlinePillText}>⭐ RECOMMENDED</Text>
                  </View>
                  {isSplitEligible && (
                    <View style={styles.zeroFeePill}>
                      <Text style={styles.zeroFeePillText}>ZERO MDR</Text>
                    </View>
                  )}
                </View>

                <View
                  style={[
                    styles.radio,
                    selectedMode === 'split' && styles.radioSelected,
                    !isSplitEligible && styles.radioDisabled,
                  ]}
                >
                  {selectedMode === 'split' && <View style={styles.radioDot} />}
                </View>
              </View>

              <Text style={styles.cardTitle}>Split & Pay</Text>
              <Text style={styles.cardSubtitle}>
                Pay in instalments capped at ₹1,999.00 each. Eliminates merchant MDR charges entirely.
              </Text>

              {/* Dynamic split preview text */}
              {isSplitEligible && splitPreviewText && (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewLabel}>SCHEDULE</Text>
                  <Text style={styles.previewText}>{splitPreviewText}</Text>
                </View>
              )}

              {/* Disabled Explanation */}
              {!isSplitEligible && disabledReason && (
                <View style={styles.disabledReasonContainer}>
                  <AppIcon name="info" size={14} color="#8E92A8" />
                  <Text style={styles.disabledReasonText}>{disabledReason}</Text>
                </View>
              )}
            </GlassCard>
          </TouchableOpacity>

          {/* Pay Direct Card */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handleSelectMode('direct')}
          >
            <GlassCard
              elevated={selectedMode === 'direct'}
              style={[
                styles.methodCard,
                selectedMode === 'direct' && styles.selectedMethodCard,
              ]}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.standardLabel}>STANDARD</Text>
                <View
                  style={[
                    styles.radio,
                    selectedMode === 'direct' && styles.radioSelected,
                  ]}
                >
                  {selectedMode === 'direct' && <View style={styles.radioDot} />}
                </View>
              </View>

              <Text style={styles.cardTitle}>Pay Direct</Text>
              <Text style={styles.cardSubtitle}>
                One single transaction for the entire ₹{totalFormatted.rupeePart}.{totalFormatted.decimalPart}.
              </Text>
            </GlassCard>
          </TouchableOpacity>
        </View>

        {/* Collapsible Explainer per Section 4.4 */}
        <View style={styles.explainerWrapper}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              try {
                ReactNativeHapticFeedback.trigger('selection');
              } catch {}
              setShowExplainer(!showExplainer);
            }}
            style={styles.explainerChip}
          >
            <Text style={styles.explainerChipText}>
              {showExplainer ? 'Hide explanation ▲' : 'What is Split & Pay? ▼'}
            </Text>
          </TouchableOpacity>

          {showExplainer && (
            <GlassCard style={styles.explainerBody}>
              <Text style={styles.explainerParagraph}>
                NoFeePe automatically breaks large amounts into consecutive payments capped at ₹1,999.00 each to the same merchant.
              </Text>
              <Text style={[styles.explainerParagraph, { marginTop: spacing.sm }]}>
                NPCI guidelines allow zero MDR on transactions up to ₹2,000. You will approve each instalment consecutively in your chosen UPI app.
              </Text>
            </GlassCard>
          )}
        </View>
      </ScrollView>

      {/* Primary Proceed Action */}
      <View style={styles.footer}>
        <GradientButton
          label={
            selectedMode === 'split' && splitPlanResult
              ? `Proceed with ${splitPlanResult.count} Payments`
              : 'Proceed with Direct Payment'
          }
          onPress={handleProceed}
          variant="primary"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070B',
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...typography.headingSm,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  backPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  summaryCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  summaryLabel: {
    ...typography.captionMedium,
    color: colors?.textMuted ?? '#8E92A8',
    letterSpacing: 1.2,
    fontSize: 11,
    fontWeight: '700',
  },
  amountDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: spacing.xs,
  },
  currencySymbol: {
    ...typography.currencyDisplay,
    fontSize: 24,
    color: colors?.textMuted ?? '#8E92A8',
    marginRight: 4,
  },
  amountNumber: {
    ...typography.currencyDisplay,
    fontSize: 38,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
  },
  amountDecimals: {
    ...typography.currencyDisplay,
    fontSize: 24,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '600',
  },
  payeeSubtext: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
  },
  cardsContainer: {
    gap: spacing.md,
  },
  methodCard: {
    padding: spacing.lg,
    borderColor: colors?.glassBorder ?? 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
  },
  selectedMethodCard: {
    borderColor: colors?.accentStart ?? '#00F5A0',
    backgroundColor: 'rgba(0, 245, 160, 0.04)',
  },
  disabledMethodCard: {
    opacity: 0.55,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  headlinePill: {
    backgroundColor: 'rgba(0, 245, 160, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii?.pill ?? 9999,
  },
  headlinePillText: {
    ...typography.caption,
    fontSize: 10,
    color: colors?.textPurpleLight ?? '#C4B5FD',
    fontWeight: '800',
  },
  zeroFeePill: {
    backgroundColor: 'rgba(0, 217, 245, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii?.pill ?? 9999,
  },
  zeroFeePillText: {
    ...typography.caption,
    fontSize: 10,
    color: colors?.accentEnd ?? '#00D9F5',
    fontWeight: '800',
  },
  standardLabel: {
    ...typography.captionMedium,
    color: colors?.textMuted ?? '#8E92A8',
    letterSpacing: 1,
    fontSize: 10,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors?.glassBorder ?? 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors?.accentStart ?? '#00F5A0',
  },
  radioDisabled: {
    borderColor: colors?.textFaint ?? '#5A5F73',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors?.accentStart ?? '#00F5A0',
  },
  cardTitle: {
    ...typography.headingSm,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    ...typography.body,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 13,
    lineHeight: 18,
  },
  previewContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  previewLabel: {
    ...typography.captionMedium,
    fontSize: 10,
    color: colors?.accentEnd ?? '#00D9F5',
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 2,
  },
  previewText: {
    ...typography.caption,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  disabledReasonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  disabledReasonText: {
    ...typography.caption,
    color: colors?.warning ?? '#FFB020',
    fontSize: 12,
  },
  explainerWrapper: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  explainerChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii?.pill ?? 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  explainerChipText: {
    ...typography.caption,
    color: colors?.accentEnd ?? '#00D9F5',
    fontWeight: '600',
    fontSize: 12,
  },
  explainerBody: {
    marginTop: spacing.md,
    padding: spacing.md,
    width: '100%',
  },
  explainerParagraph: {
    ...typography.body,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    paddingVertical: spacing.md,
  },
});
