import React from 'react';
import { Text, StyleSheet, View, ViewStyle, StyleProp, TextStyle } from 'react-native';
import { colors, typography } from '../theme/tokens';

interface AmountTextProps {
  amountPaise: number;
  size?: 'lg' | 'md' | 'sm' | 'hero';
  showDecimals?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  currencySymbolColor?: string;
}

/**
 * Formats integer paise into Indian Rupee string with proper digit grouping (en-IN).
 * e.g. 10000000 paise -> { rupeePart: "1,00,000", decimalPart: "00" }
 *
 * Guarded against NaN, undefined, or null inputs to guarantee zero crashes.
 */
export function formatIndianCurrency(
  paise: number,
  _options?: { showZeroDecimals?: boolean }
): { rupeePart: string; decimalPart: string } {
  try {
    if (typeof paise !== 'number' || isNaN(paise)) {
      return { rupeePart: '0', decimalPart: '00' };
    }

    const isNegative = paise < 0;
    const absPaise = Math.abs(Math.round(paise));
    const rupees = Math.floor(absPaise / 100);
    const decimals = absPaise % 100;

    // Format rupee part using Indian numbering system (e.g. 1,00,000)
    let rupeePart = '0';
    try {
      rupeePart = new Intl.NumberFormat('en-IN').format(rupees);
    } catch {
      rupeePart = rupees.toString();
    }
    const decimalPart = decimals.toString().padStart(2, '0');

    return {
      rupeePart: `${isNegative ? '-' : ''}${rupeePart}`,
      decimalPart,
    };
  } catch (err: unknown) {
    console.warn('[AmountText] formatIndianCurrency fallback triggered:', err);
    return { rupeePart: '0', decimalPart: '00' };
  }
}

/**
 * Visual currency display component with large rupee numerals and muted decimals.
 */
export const AmountText: React.FC<AmountTextProps> = ({
  amountPaise,
  size = 'md',
  showDecimals = true,
  style,
  textStyle,
  currencySymbolColor,
}) => {
  const { rupeePart, decimalPart } = formatIndianCurrency(amountPaise);

  const getFontSize = () => {
    switch (size) {
      case 'hero':
        return 40;
      case 'lg':
        return 28;
      case 'md':
        return 20;
      case 'sm':
      default:
        return 15;
    }
  };

  const fontSize = getFontSize();

  return (
    <View style={[styles.container, style]}>
      <Text
        style={[
          styles.symbol,
          { fontSize: fontSize * 0.75 },
          currencySymbolColor ? { color: currencySymbolColor } : undefined,
        ]}
      >
        ₹
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit={true}
        minimumFontScale={0.65}
        style={[styles.rupeeText, { fontSize }, textStyle]}
      >
        {rupeePart}
      </Text>
      {showDecimals && (
        <Text style={[styles.decimalText, { fontSize: fontSize * 0.75 }]}>
          .{decimalPart}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  symbol: {
    color: colors?.textMuted ?? '#8E92A8',
    fontWeight: '600',
    marginRight: 2,
  },
  rupeeText: {
    ...typography.currencyDisplay,
    color: colors?.textPrimary ?? '#FFFFFF',
  },
  decimalText: {
    ...typography.currencyDisplay,
    color: colors?.textMuted ?? '#8E92A8',
  },
});
