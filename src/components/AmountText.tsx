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
 * Formats paise into Indian Rupee string with proper digit grouping (en-IN).
 * e.g. 10000000 paise -> "1,00,000.00"
 */
export function formatIndianCurrency(
  paise: number,
  options?: { showZeroDecimals?: boolean }
): { rupeePart: string; decimalPart: string } {
  const isNegative = paise < 0;
  const absPaise = Math.abs(Math.round(paise));
  const rupees = Math.floor(absPaise / 100);
  const decimals = absPaise % 100;

  // Format rupee part using Indian numbering (e.g. 1,00,000)
  const rupeePart = new Intl.NumberFormat('en-IN').format(rupees);
  const decimalPart = decimals.toString().padStart(2, '0');

  return {
    rupeePart: `${isNegative ? '-' : ''}${rupeePart}`,
    decimalPart,
  };
}

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
    color: colors.textMuted,
    fontWeight: '600',
    marginRight: 2,
  },
  rupeeText: {
    ...typography.currencyDisplay,
    color: colors.textPrimary,
  },
  decimalText: {
    ...typography.currencyDisplay,
    color: colors.textMuted,
  },
});
