import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderColor?: string;
  backgroundColor?: string;
  elevated?: boolean;
}

/**
 * High-performance glass panel per AGENTS.md Section 12.
 * Uses semi-transparent fill + 1px border + top highlight line instead of heavy GPU blur,
 * guaranteeing 60/120 FPS on Android.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  borderColor,
  backgroundColor,
  elevated = false,
}) => {
  return (
    <View
      style={[
        styles.card,
        elevated && styles.elevated,
        backgroundColor ? { backgroundColor } : undefined,
        borderColor ? { borderColor } : undefined,
        style,
      ]}
    >
      {/* Subtle top inner highlight line for glass depth */}
      <View style={styles.topHighlight} pointerEvents="none" />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glassFill,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  elevated: {
    backgroundColor: colors.bgElevated,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.glassHighlight,
  },
});
