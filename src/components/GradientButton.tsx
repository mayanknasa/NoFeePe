import React from 'react';
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  StyleProp,
  View,
  ViewProps,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, radii, spacing, typography } from '../theme/tokens';

interface AndroidProtectedViewProps extends ViewProps {
  filterTouchesWhenObscured?: boolean;
}

const ProtectedView = View as unknown as React.ComponentType<AndroidProtectedViewProps>;

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  cooldownSeconds?: number | null;
  style?: StyleProp<ViewStyle>;
  variant?: 'primary' | 'danger' | 'glass';
  icon?: React.ReactNode;
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  cooldownSeconds,
  style,
  variant = 'primary',
  icon,
}) => {
  const isCooldown = typeof cooldownSeconds === 'number' && cooldownSeconds > 0;
  const isDisabled = disabled || loading || isCooldown;

  const displayLabel = isCooldown ? `Next payment in ${cooldownSeconds}` : label;

  const renderContent = () => (
    <View style={styles.contentRow}>
      {loading ? (
        <ActivityIndicator color="#07070B" size="small" />
      ) : (
        <>
          <Text
            style={[
              styles.text,
              variant === 'glass' && styles.glassText,
              variant === 'danger' && styles.dangerText,
            ]}
          >
            {displayLabel}
          </Text>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
        </>
      )}
    </View>
  );

  if (variant === 'primary') {
    return (
      <ProtectedView
        filterTouchesWhenObscured={true}
        style={[styles.wrapper, isDisabled && styles.disabledWrapper, style]}
      >
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onPress}
          disabled={isDisabled}
          style={styles.touchable}
        >
          <LinearGradient
            colors={
              isDisabled
                ? ['#3B3D4D', '#2B2D38']
                : (colors.accentGradient as unknown as string[])
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {renderContent()}
          </LinearGradient>
        </TouchableOpacity>
      </ProtectedView>
    );
  }

  return (
    <ProtectedView
      filterTouchesWhenObscured={true}
      style={[styles.wrapper, isDisabled && styles.disabledWrapper, style]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        disabled={isDisabled}
        style={[
          styles.touchable,
          variant === 'glass' && styles.glassButton,
          variant === 'danger' && styles.dangerButton,
        ]}
      >
        {renderContent()}
      </TouchableOpacity>
    </ProtectedView>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.button,
    overflow: 'hidden',
  },
  touchable: {
    borderRadius: radii.button,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  glassButton: {
    backgroundColor: colors.glassFill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  dangerButton: {
    backgroundColor: colors.dangerFill,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  disabledWrapper: {
    opacity: 0.55,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.bodyMedium,
    color: '#07070B', // Dark high-contrast text on bright neon gradient
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  glassText: {
    color: colors.textPrimary,
  },
  dangerText: {
    color: colors.danger,
  },
  iconContainer: {
    marginLeft: spacing.sm,
  },
});
