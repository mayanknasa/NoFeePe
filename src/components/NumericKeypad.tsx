import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/tokens';

interface NumericKeypadProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', '⌫'],
] as const;

/**
 * Custom in-app numeric keypad per Section 4.3.
 * Replaces the system keyboard with a zero-layout-shift glass keypad.
 */
export const NumericKeypad: React.FC<NumericKeypadProps> = React.memo(({
  onKeyPress,
  onBackspace,
  disabled = false,
}) => {
  const handlePress = (key: string) => {
    if (disabled) return;
    try {
      if (key === '⌫') {
        onBackspace?.();
      } else {
        onKeyPress?.(key);
      }
    } catch (err: unknown) {
      console.warn('[NumericKeypad] handlePress error:', err);
    }
  };

  return (
    <View style={styles.container}>
      {KEYPAD_ROWS.map((row, rIdx) => (
        <View key={rIdx} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              activeOpacity={0.65}
              disabled={disabled}
              onPress={() => handlePress(key)}
              style={[styles.key, disabled && styles.disabledKey]}
            >
              <Text
                style={[
                  styles.keyText,
                  key === '⌫' && styles.backspaceText,
                  disabled && styles.disabledText,
                ]}
              >
                {key}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
});

/**
 * Pure helper function to apply numeric input rules from Section 4.3:
 * - Leading zero handling: typing '0' then '5' produces '5', not '05'.
 * - Decimal rules: at most one decimal point, at most two digits after it. Further keypresses ignored.
 * - Maximum total: Rs 1,00,000 (100000.00).
 */
export function applyKeypadInput(current: string, key: string): string {
  try {
    const safeCurrent = current ?? '';

    if (key === '⌫') {
      if (safeCurrent.length <= 1) return '';
      return safeCurrent.slice(0, -1);
    }

    if (key === '.') {
      if (safeCurrent.includes('.')) {
        return safeCurrent; // Ignore duplicate decimal point
      }
      return safeCurrent === '' ? '0.' : `${safeCurrent}.`;
    }

    // Digits 0 - 9
    if (safeCurrent.includes('.')) {
      const parts = safeCurrent.split('.');
      if (parts[1] && parts[1].length >= 2) {
        return safeCurrent; // Ignore keypresses beyond 2 decimal places
      }
      return `${safeCurrent}${key}`;
    }

    // Integer part: replace solitary zero with typed digit
    if (safeCurrent === '0') {
      return key;
    }

    const next = `${safeCurrent}${key}`;
    const num = parseFloat(next);
    if (!isNaN(num) && num > 100000) {
      return safeCurrent; // Hard cap at Rs 1,00,000
    }

    return next;
  } catch (err: unknown) {
    console.warn('[NumericKeypad] applyKeypadInput error:', err);
    return current ?? '';
  }
}

/**
 * Converts rupee string into integer paise.
 * e.g. "1999.00" -> 199900
 * e.g. "5" -> 500
 */
export function parseRupeeStringToPaise(str: string): number {
  if (!str || typeof str !== 'string') return 0;
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  key: {
    flex: 1,
    height: 60,
    backgroundColor: colors?.glassFill ?? 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radii?.row ?? 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledKey: {
    opacity: 0.4,
  },
  keyText: {
    ...typography.currencyDisplay,
    fontSize: 24,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '600',
  },
  backspaceText: {
    fontSize: 22,
    color: colors?.textMuted ?? '#8E92A8',
  },
  disabledText: {
    color: colors?.textFaint ?? '#5A5F73',
  },
});
