import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { RootStackParamList } from '../types';
import { maskVpa } from '../domain/upi';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import {
  NumericKeypad,
  applyKeypadInput,
  parseRupeeStringToPaise,
} from '../components/NumericKeypad';
import { formatIndianCurrency } from '../components/AmountText';

type Props = NativeStackScreenProps<RootStackParamList, 'Amount'>;

export const AmountScreen: React.FC<Props> = ({ route, navigation }) => {
  const {
    payeeVpa,
    payeeName,
    fixedAmountPaise,
    merchantCode,
    signature,
    transactionNote,
  } = route.params;

  const isFixedAmount = typeof fixedAmountPaise === 'number' && fixedAmountPaise > 0;

  // Initialize input string if fixed amount is given
  const [amountStr, setAmountStr] = useState<string>(() => {
    if (isFixedAmount) {
      return (fixedAmountPaise / 100).toFixed(2);
    }
    return '';
  });

  const amountPaise = useMemo(() => {
    return parseRupeeStringToPaise(amountStr);
  }, [amountStr]);

  const isValidAmount = amountPaise >= 100 && amountPaise <= 10000000;
  const isTooLarge = amountPaise > 10000000;

  const handleKeyPress = (key: string) => {
    if (isFixedAmount) return; // locked if fixed amount

    try {
      ReactNativeHapticFeedback.trigger('impactLight', {
        enableVibrateFallback: true,
      });
    } catch {}

    setAmountStr((prev) => applyKeypadInput(prev, key));
  };

  const handleBackspace = () => {
    if (isFixedAmount) return;

    try {
      ReactNativeHapticFeedback.trigger('impactLight', {
        enableVibrateFallback: true,
      });
    } catch {}

    setAmountStr((prev) => applyKeypadInput(prev, '⌫'));
  };

  const handleContinue = () => {
    if (!isValidAmount) return;

    try {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
      });
    } catch {}

    // Navigate to Method screen with current parameters stored
    navigation.navigate('Method');
  };

  // Formatting display per Section 4.3:
  // "always exactly two decimal places once the user has typed a decimal point,
  // otherwise show the rupee part with .00 appended in a muted colour."
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
      const [intPart, decPart] = amountStr.split('.');
      const formattedInt = new Intl.NumberFormat('en-IN').format(
        parseInt(intPart || '0', 10)
      );
      return (
        <View style={styles.amountRow}>
          <Text style={styles.currencySymbol}>₹</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit={true}
            style={styles.enteredAmount}
          >
            {formattedInt}
          </Text>
          <Text style={styles.enteredDecimals}>.{decPart}</Text>
        </View>
      );
    }

    const formattedInt = new Intl.NumberFormat('en-IN').format(
      parseInt(amountStr, 10)
    );
    return (
      <View style={styles.amountRow}>
        <Text style={styles.currencySymbol}>₹</Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit={true}
          style={styles.enteredAmount}
        >
          {formattedInt}
        </Text>
        <Text style={styles.mutedDecimals}>.00</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Enter Amount</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        {/* Payee Glass Card with Masked VPA per Section 4.3 & 11.8 */}
        <GlassCard elevated style={styles.payeeCard}>
          <View style={styles.payeeIconContainer}>
            <Text style={styles.payeeIcon}>🏬</Text>
          </View>
          <View style={styles.payeeDetails}>
            <Text numberOfLines={2} style={styles.payeeName}>
              {payeeName || 'UPI Merchant'}
            </Text>
            <Text style={styles.payeeVpa}>{maskVpa(payeeVpa)}</Text>
          </View>
          {isFixedAmount && (
            <View style={styles.fixedPill}>
              <Text style={styles.fixedPillText}>Fixed by merchant</Text>
            </View>
          )}
        </GlassCard>

        {/* Large Amount Display Section */}
        <View style={styles.amountDisplayContainer}>
          <Text style={styles.amountLabel}>PAYING TOTAL</Text>
          {renderFormattedAmount()}

          {/* Validation Warnings */}
          {isTooLarge && (
            <Text style={styles.errorText}>
              Maximum supported amount is ₹1,00,000.00
            </Text>
          )}
          {amountPaise > 0 && amountPaise < 100 && (
            <Text style={styles.warningText}>Minimum payable amount is ₹1.00</Text>
          )}
        </View>

        {/* Custom On-Screen Numeric Keypad per Section 4.3 */}
        <View style={styles.keypadContainer}>
          <NumericKeypad
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            disabled={isFixedAmount}
          />
        </View>

        {/* Continue Button */}
        <View style={styles.ctaContainer}>
          <GradientButton
            label={
              amountPaise >= 100
                ? `Continue • ₹${(amountPaise / 100).toFixed(2)}`
                : 'Enter Amount'
            }
            onPress={handleContinue}
            disabled={!isValidAmount}
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
  payeeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  payeeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payeeIcon: {
    fontSize: 22,
  },
  payeeDetails: {
    flex: 1,
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
  fixedPill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 176, 32, 0.15)',
    borderWidth: 1,
    borderColor: colors.pending,
  },
  fixedPillText: {
    ...typography.pillLabel,
    color: colors.pending,
  },
  amountDisplayContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  amountLabel: {
    ...typography.captionMedium,
    color: colors.textFaint,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  currencySymbol: {
    ...typography.currencyDisplay,
    fontSize: 32,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  enteredAmount: {
    ...typography.currencyDisplay,
    fontSize: 48,
    color: colors.textPrimary,
  },
  zeroAmount: {
    ...typography.currencyDisplay,
    fontSize: 48,
    color: colors.textMuted,
  },
  enteredDecimals: {
    ...typography.currencyDisplay,
    fontSize: 32,
    color: colors.textPrimary,
  },
  mutedDecimals: {
    ...typography.currencyDisplay,
    fontSize: 32,
    color: colors.textFaint,
  },
  errorText: {
    ...typography.captionMedium,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  warningText: {
    ...typography.captionMedium,
    color: colors.pending,
    marginTop: spacing.sm,
  },
  keypadContainer: {
    width: '100%',
  },
  ctaContainer: {
    width: '100%',
    paddingTop: spacing.sm,
  },
});
