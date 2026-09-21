import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { RootStackParamList, PaymentMode } from '../types';
import { planSplit, SplitError } from '../domain/split';
import { maskVpa } from '../domain/upi';
import { useSessionStore } from '../store/sessionStore';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { formatIndianCurrency } from '../components/AmountText';

type Props = NativeStackScreenProps<RootStackParamList, 'Method'>;

export const MethodScreen: React.FC<Props> = ({ navigation }) => {
  const session = useSessionStore();
  const initSession = useSessionStore((state) => state.initSession);

  // Read amount and payee from session store or route
  const totalPaise = session.totalPaise;
  const payeeVpa = session.payeeVpa;
  const payeeName = session.payeeName;
  const isFixedAmount = !!session.signature && totalPaise > 0; // or fixed am

  const isSplitEligible = totalPaise > 199900 && !isFixedAmount;

  // Compute live split preview
  const splitPlanResult = useMemo(() => {
    if (!isSplitEligible) return null;
    try {
      return planSplit(totalPaise);
    } catch (err) {
      return null;
    }
  }, [totalPaise, isSplitEligible]);

  const splitPreviewText = useMemo(() => {
    if (!splitPlanResult) return null;
    const fullLegCount = splitPlanResult.legs.filter((l) => l === 199900).length;
    const remainderLeg = splitPlanResult.legs.find((l) => l !== 199900);

    const parts: string[] = [];
    if (fullLegCount > 0) {
      parts.push(`${fullLegCount} x ₹1,999.00`);
    }
    if (remainderLeg) {
      parts.push(`₹${(remainderLeg / 100).toFixed(2)}`);
    }

    return `${splitPlanResult.count} payments: ${parts.join(' + ')}`;
  }, [splitPlanResult]);

  const disabledReason = useMemo(() => {
    if (isFixedAmount) {
      return 'This QR has a fixed amount set by the merchant.';
    }
    if (totalPaise <= 199900) {
      return 'Available for bills above Rs 1,999.00';
    }
    return null;
  }, [isFixedAmount, totalPaise]);

  // Default mode: split if available, otherwise direct
  const [selectedMode, setSelectedMode] = useState<PaymentMode>(
    isSplitEligible ? 'split' : 'direct'
  );
  const [showExplainer, setShowExplainer] = useState(false);

  const handleSelectMode = (mode: PaymentMode) => {
    if (mode === 'split' && !isSplitEligible) return;

    try {
      ReactNativeHapticFeedback.trigger('selection', {
        enableVibrateFallback: true,
      });
    } catch {}

    setSelectedMode(mode);
  };

  const handleProceed = () => {
    try {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
      });
    } catch {}

    let plannedLegs: number[] = [];
    if (selectedMode === 'split' && splitPlanResult) {
      plannedLegs = splitPlanResult.legs;
    } else {
      plannedLegs = [totalPaise];
    }

    initSession({
      payeeVpa: session.payeeVpa,
      payeeName: session.payeeName,
      merchantCode: session.merchantCode,
      transactionNote: session.transactionNote,
      signature: session.signature,
      totalPaise: session.totalPaise,
      mode: selectedMode,
      legs: plannedLegs,
    });

    navigation.navigate('Pay');
  };

  const totalFormatted = formatIndianCurrency(totalPaise);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payment Mode</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Target Amount Card */}
          <GlassCard style={styles.amountCard}>
            <View style={styles.amountHeader}>
              <View>
                <Text numberOfLines={1} style={styles.payeeName}>
                  {payeeName || 'Merchant'}
                </Text>
                <Text style={styles.payeeVpa}>{maskVpa(payeeVpa)}</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL TO PAY</Text>
              <Text style={styles.totalValue}>
                ₹{totalFormatted.rupeePart}.{totalFormatted.decimalPart}
              </Text>
            </View>
          </GlassCard>

          <Text style={styles.sectionHeader}>SELECT ROUTING MODE</Text>

          {/* Option 1: Pay Direct (Always Enabled per Section 4.4) */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => handleSelectMode('direct')}
          >
            <GlassCard
              elevated={selectedMode === 'direct'}
              borderColor={
                selectedMode === 'direct' ? colors.accentStart : colors.glassBorder
              }
              style={styles.modeCard}
            >
              <View style={styles.modeCardHeader}>
                <View style={styles.modeCardTitleRow}>
                  <View
                    style={[
                      styles.radioOuter,
                      selectedMode === 'direct' && styles.radioOuterSelected,
                    ]}
                  >
                    {selectedMode === 'direct' && <View style={styles.radioInner} />}
                  </View>
                  <View>
                    <View style={styles.titleBadgeRow}>
                      <Text style={styles.modeTitle}>Pay Direct</Text>
                      <View style={styles.standardPill}>
                        <Text style={styles.standardPillText}>Standard</Text>
                      </View>
                    </View>
                    <Text style={styles.modeSubtitle}>
                      Pay ₹{totalFormatted.rupeePart}.{totalFormatted.decimalPart} in a single standard transaction.
                    </Text>
                  </View>
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>

          {/* Option 2: Split & Pay (Enabled if > Rs 1999 and not fixed) */}
          <TouchableOpacity
            activeOpacity={isSplitEligible ? 0.8 : 1}
            onPress={() => handleSelectMode('split')}
          >
            <GlassCard
              elevated={selectedMode === 'split'}
              borderColor={
                selectedMode === 'split' ? colors.accentEnd : colors.glassBorder
              }
              style={[
                styles.modeCard,
                !isSplitEligible && styles.modeCardDisabled,
              ]}
            >
              <View style={styles.modeCardHeader}>
                <View style={styles.modeCardTitleRow}>
                  <View
                    style={[
                      styles.radioOuter,
                      selectedMode === 'split' && styles.radioOuterSelected,
                    ]}
                  >
                    {selectedMode === 'split' && <View style={styles.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleBadgeRow}>
                      <Text
                        style={[
                          styles.modeTitle,
                          !isSplitEligible && styles.textDisabled,
                        ]}
                      >
                        Split & Pay
                      </Text>
                      {isSplitEligible && (
                        <View style={styles.recommendedPill}>
                          <Text style={styles.recommendedPillText}>
                            Zero MDR
                          </Text>
                        </View>
                      )}
                    </View>

                    {isSplitEligible ? (
                      <>
                        <Text style={styles.modeSubtitle}>
                          Auto-split into micro-transactions under Rs 1,999 to bypass processor fees and daily limits.
                        </Text>
                        {/* Preview Line per Section 4.4 */}
                        {splitPreviewText && (
                          <View style={styles.previewContainer}>
                            <Text style={styles.previewText}>
                              ⚡ {splitPreviewText}
                            </Text>
                          </View>
                        )}
                      </>
                    ) : (
                      /* Reason shown if disabled per Section 4.4 */
                      <Text style={styles.disabledReasonText}>
                        {disabledReason}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>

          {/* Collapsible Explainer Chip per Section 4.4 */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowExplainer(!showExplainer)}
            style={styles.explainerChip}
          >
            <Text style={styles.explainerIcon}>ℹ️</Text>
            <Text style={styles.explainerText}>What is Split & Pay?</Text>
            <Text style={styles.explainerChevron}>{showExplainer ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showExplainer && (
            <GlassCard style={styles.explainerContent}>
              <Text style={styles.explainerParagraph}>
                noFeePe will send several separate payments to the same UPI ID,
                one after another, capped at ₹1,999.00 each.
              </Text>
              <Text style={[styles.explainerParagraph, { marginTop: spacing.xs }]}>
                You must authorize each payment in your chosen UPI app. Completed
                payments cannot be reversed by noFeePe.
              </Text>
            </GlassCard>
          )}
        </ScrollView>

        {/* CTA Bottom Button */}
        <View style={styles.ctaContainer}>
          <GradientButton
            label={`Proceed with ${selectedMode === 'split' ? 'Split & Pay' : 'Pay Direct'}`}
            onPress={handleProceed}
          />
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
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.glassFill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitle: {
    ...typography.title,
    fontSize: 16,
  },
  headerRightPlaceholder: {
    width: 40,
  },
  scrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  amountCard: {
    padding: spacing.md + 2,
  },
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
  },
  payeeName: {
    ...typography.title,
    fontSize: 15,
  },
  payeeVpa: {
    ...typography.captionMedium,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  verifiedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(43, 217, 160, 0.15)',
    borderWidth: 1,
    borderColor: colors.success,
  },
  verifiedText: {
    ...typography.pillLabel,
    color: colors.success,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  totalLabel: {
    ...typography.captionMedium,
    color: colors.textFaint,
    letterSpacing: 1,
  },
  totalValue: {
    ...typography.headingMd,
    fontSize: 22,
    color: colors.textPrimary,
  },
  sectionHeader: {
    ...typography.captionMedium,
    color: colors.textFaint,
    letterSpacing: 1.2,
    marginTop: spacing.xs,
  },
  modeCard: {
    padding: spacing.md + 2,
  },
  modeCardDisabled: {
    opacity: 0.6,
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modeCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    flex: 1,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioOuterSelected: {
    borderColor: colors.accentEnd,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accentEnd,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modeTitle: {
    ...typography.title,
    fontSize: 16,
  },
  textDisabled: {
    color: colors.textMuted,
  },
  standardPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  standardPillText: {
    ...typography.pillLabel,
    color: colors.textMuted,
  },
  recommendedPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(34, 211, 238, 0.15)',
    borderWidth: 1,
    borderColor: colors.accentEnd,
  },
  recommendedPillText: {
    ...typography.pillLabel,
    color: colors.accentEnd,
  },
  modeSubtitle: {
    ...typography.body,
    fontSize: 13,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  previewContainer: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(124, 92, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 255, 0.3)',
    alignSelf: 'flex-start',
  },
  previewText: {
    ...typography.captionMedium,
    color: colors.accentEnd,
    fontSize: 12,
  },
  disabledReasonText: {
    ...typography.captionMedium,
    color: colors.textFaint,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  explainerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.glassFill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignSelf: 'flex-start',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  explainerIcon: {
    fontSize: 14,
  },
  explainerText: {
    ...typography.captionMedium,
    color: colors.textMuted,
  },
  explainerChevron: {
    fontSize: 10,
    color: colors.textFaint,
    marginLeft: spacing.xs,
  },
  explainerContent: {
    padding: spacing.md,
    borderRadius: radii.row,
  },
  explainerParagraph: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  ctaContainer: {
    paddingTop: spacing.sm,
  },
});
