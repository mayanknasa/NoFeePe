import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessionStore } from '../store/sessionStore';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { RootStackParamList } from '../types';
import { maskVpa } from '../domain/upi';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { BackButton } from '../components/BackButton';
import {
  NumericKeypad,
  applyKeypadInput,
  parseRupeeStringToPaise,
} from '../components/NumericKeypad';
import { formatIndianCurrency } from '../components/AmountText';

type Props = NativeStackScreenProps<RootStackParamList, 'Amount'>;

/**
 * Amount Entry Screen.
 * Implements Section 4.3 of AGENTS.md:
 * - Glass card showing payee name and masked VPA.
 * - Large right-aligned amount display using Indian digit grouping (e.g. 1,00,000.00).
 * - Custom in-app numeric keypad with leading zero protection and decimal precision clamping.
 * - Locks amount if the scanned QR included a merchant-fixed amount (`am=`).
 * - Continue button enabled only for amounts >= Rs 1.00 and <= Rs 1,00,000.
 */
export const AmountScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const initSession = useSessionStore((state) => state.initSession);

  const payeeVpa = route?.params?.payeeVpa ?? '';
  const payeeName = route?.params?.payeeName ?? null;
  const fixedAmountPaise = route?.params?.fixedAmountPaise ?? null;
  const merchantCode = route?.params?.merchantCode ?? null;
  const signature = route?.params?.signature ?? null;
  const transactionNote = route?.params?.transactionNote ?? null;

  const isFixedAmount = typeof fixedAmountPaise === 'number' && fixedAmountPaise > 0;

  // Initialize input string if fixed amount is given in QR
  const [amountStr, setAmountStr] = useState<string>(() => {
    try {
      if (isFixedAmount && fixedAmountPaise) {
        return (fixedAmountPaise / 100).toFixed(2);
      }
    } catch (err: unknown) {
      console.warn('[AmountScreen] Fixed amount initialization error:', err);
    }
    return '';
  });

  const amountPaise = useMemo(() => {
    try {
      return parseRupeeStringToPaise(amountStr);
    } catch {
      return 0;
    }
  }, [amountStr]);

  const isValidAmount = amountPaise >= 100 && amountPaise <= 10000000;
  const isTooLarge = amountPaise > 10000000;

  const handleKeyPress = useCallback((key: string) => {
    if (isFixedAmount) return; // Locked if merchant fixed amount

    try {
      ReactNativeHapticFeedback.trigger('impactLight', {
        enableVibrateFallback: true,
      });
    } catch (err: unknown) {
      console.debug?.('[AmountScreen] Haptic error:', err);
    }

    try {
      setAmountStr((prev) => applyKeypadInput(prev, key));
    } catch (err: unknown) {
      console.warn('[AmountScreen] Keypad input error:', err);
    }
  }, [isFixedAmount]);

  const handleBackspace = useCallback(() => {
    if (isFixedAmount) return;

    try {
      ReactNativeHapticFeedback.trigger('impactLight', {
        enableVibrateFallback: true,
      });
    } catch (err: unknown) {
      console.debug?.('[AmountScreen] Haptic error:', err);
    }

    try {
      setAmountStr((prev) => applyKeypadInput(prev, '⌫'));
    } catch (err: unknown) {
      console.warn('[AmountScreen] Backspace error:', err);
    }
  }, [isFixedAmount]);

  const handleContinue = () => {
    if (!isValidAmount) return;

    try {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
      });
    } catch (err: unknown) {
      console.debug?.('[AmountScreen] Haptic error:', err);
    }

    try {
      // Initialize in-memory session store with entered amount and payee metadata
      initSession?.({
        payeeVpa,
        payeeName: payeeName || null,
        merchantCode: merchantCode || null,
        transactionNote: transactionNote || null,
        signature: signature || null,
        totalPaise: amountPaise,
        mode: 'direct',
        legs: [amountPaise],
      });

      // Navigate to Method selection screen
      navigation?.navigate?.('Method');
    } catch (err: unknown) {
      console.warn('[AmountScreen] handleContinue navigation error:', err);
    }
  };

  // Formatting display per Section 4.3:
  // Shows rupee part formatted with Indian digit grouping and muted .00 decimals
  const renderFormattedAmount = () => {
    if (!amountStr) {
      return (
        <View style={styles.amountRow}>
          <Text style={styles.currencySymbol}>₹</Text>
          <Text style={styles.zeroAmount}>0</Text>
          <Text style={styles.mutedDecimals}>.00</Text>
        </View>
      );
    }

    if (amountStr.includes('.')) {
      const [intPart, decPart = ''] = amountStr.split('.');
      const formattedInt = formatIndianCurrency(parseInt(intPart, 10) * 100 || 0).rupeePart;
      return (
        <View style={styles.amountRow}>
          <Text style={styles.currencySymbol}>₹</Text>
          <Text style={styles.amountInteger}>{formattedInt}</Text>
          <Text style={styles.amountDecimals}>.{decPart.padEnd(2, '0')}</Text>
        </View>
      );
    }

    const formatted = formatIndianCurrency(parseInt(amountStr, 10) * 100 || 0).rupeePart;
    return (
      <View style={styles.amountRow}>
        <Text style={styles.currencySymbol}>₹</Text>
        <Text style={styles.amountInteger}>{formatted}</Text>
        <Text style={styles.mutedDecimals}>.00</Text>
      </View>
    );
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
      {/* Top Section */}
      <View style={styles.topSection}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton
            onPress={() => {
              try {
                navigation?.goBack?.();
              } catch (err: unknown) {
                console.warn('[AmountScreen] Back error:', err);
              }
            }}
          />
          <Text style={styles.headerTitle}>Enter Amount</Text>
          <View style={styles.backPlaceholder} />
        </View>

        {/* Payee Glass Card */}
        <GlassCard style={styles.payeeCard}>
          <View style={styles.payeeRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {payeeName ? payeeName.charAt(0).toUpperCase() : '₹'}
              </Text>
            </View>
            <View style={styles.payeeInfo}>
              <Text style={styles.payeeName} numberOfLines={1}>
                {payeeName || 'UPI Merchant'}
              </Text>
              <Text style={styles.payeeVpa}>{maskVpa(payeeVpa)}</Text>
            </View>
            {isFixedAmount && (
              <View style={styles.fixedPill}>
                <Text style={styles.fixedPillText}>Fixed by merchant</Text>
              </View>
            )}
          </View>
        </GlassCard>
      </View>

      {/* Center Amount Display Area */}
      <View style={styles.amountDisplayContainer}>
        {renderFormattedAmount()}

        {/* Validation error cues */}
        {isTooLarge && (
          <Text style={styles.errorText}>
            Maximum supported amount is ₹1,00,000.00
          </Text>
        )}
        {!isTooLarge && amountPaise > 0 && amountPaise < 100 && (
          <Text style={styles.warningText}>
            Minimum payable amount is ₹1.00
          </Text>
        )}
      </View>

      {/* Bottom Keypad and Continue Button */}
      <View style={styles.bottomSection}>
        <NumericKeypad
          onKeyPress={handleKeyPress}
          onBackspace={handleBackspace}
          disabled={isFixedAmount}
        />

        <View style={styles.buttonWrapper}>
          <GradientButton
            label="Continue"
            onPress={handleContinue}
            disabled={!isValidAmount}
            variant="primary"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070B',
    paddingHorizontal: spacing.md,
    justifyContent: 'space-between',
  },
  topSection: {
    width: '100%',
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
  payeeCard: {
    marginTop: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  payeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 245, 160, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.headingSm,
    color: colors?.textPurpleLight ?? '#C4B5FD',
    fontWeight: '700',
  },
  payeeInfo: {
    flex: 1,
  },
  payeeName: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
  },
  payeeVpa: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  fixedPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii?.pill ?? 9999,
    backgroundColor: 'rgba(255, 176, 32, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 176, 32, 0.3)',
  },
  fixedPillText: {
    ...typography.caption,
    color: colors?.warning ?? '#FFB020',
    fontSize: 11,
    fontWeight: '600',
  },
  amountDisplayContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    minHeight: 120,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  currencySymbol: {
    ...typography.currencyDisplay,
    fontSize: 32,
    color: colors?.textMuted ?? '#8E92A8',
    marginRight: 4,
    fontWeight: '400',
  },
  zeroAmount: {
    ...typography.currencyDisplay,
    fontSize: 54,
    color: colors?.textMuted ?? '#8E92A8',
    fontWeight: '700',
  },
  amountInteger: {
    ...typography.currencyDisplay,
    fontSize: 54,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
  },
  amountDecimals: {
    ...typography.currencyDisplay,
    fontSize: 32,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '600',
  },
  mutedDecimals: {
    ...typography.currencyDisplay,
    fontSize: 32,
    color: colors?.textFaint ?? '#5A5F73',
    fontWeight: '400',
  },
  errorText: {
    ...typography.caption,
    color: colors?.danger ?? '#EF4444',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  warningText: {
    ...typography.caption,
    color: colors?.warning ?? '#FFB020',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  bottomSection: {
    width: '100%',
    paddingBottom: spacing.xs,
  },
  buttonWrapper: {
    width: '100%',
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
});
