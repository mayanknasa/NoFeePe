import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/tokens';

interface NumericKeypadProps {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onKeyPress,
  onBackspace,
  disabled = false,
}) => {
  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫'],
  ];

  const handlePress = (key: string) => {
    if (disabled) return;
    if (key === '⌫') {
      onBackspace();
    } else {
      onKeyPress(key);
    }
  };

  return (
    <View style={styles.container}>
      {rows.map((row, rIdx) => (
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
};

/**
 * Pure helper function to apply numeric input rules from AGENTS.md Section 4.3:
 * - Leading zero handling: typing '0' then '5' produces '5', not '05'.
 * - Decimal rules: at most one decimal point, at most two digits after it. Further keypresses ignored.
 * - Maximum total: Rs 1,00,000 (100000.00).
 */
export function applyKeypadInput(current: string, key: string): string {
  if (key === '⌫') {
    if (current.length <= 1) return '';
    return current.slice(0, -1);
  }

  if (key === '.') {
    if (current.includes('.')) {
      return current; // ignore duplicate decimal point
    }
    return current === '' ? '0.' : `${current}.`;
  }

  // Digits 0 - 9
  if (current.includes('.')) {
    const parts = current.split('.');
    if (parts[1] && parts[1].length >= 2) {
      return current; // ignore further keypresses after two decimals
    }
    return `${current}${key}`;
  }

  // Integer part
  if (current === '0') {
    return key; // typing 0 then 5 produces 5, not 05
  }

  const next = `${current}${key}`;
  const num = parseFloat(next);
  if (num > 100000) {
    return current; // Cap at 1,00,000 max
  }

  return next;
}

/**
 * Converts formatted string to integer paise.
 * e.g. "1999.00" -> 199900
 * e.g. "5" -> 500
 */
export function parseRupeeStringToPaise(str: string): number {
  if (!str) return 0;
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
    backgroundColor: colors.glassFill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radii.row,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledKey: {
    opacity: 0.4,
  },
  keyText: {
    ...typography.currencyDisplay,
    fontSize: 24,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  backspaceText: {
    fontSize: 22,
    color: colors.textMuted,
  },
  disabledText: {
    color: colors.textFaint,
  },
});
