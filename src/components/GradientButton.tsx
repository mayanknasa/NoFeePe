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

  const displayLabel = isCooldown ? `Next payment in ${cooldownSeconds}s` : label;

  const renderContent = () => (
    <View style={styles.contentRow}>
      {loading ? (
        <ActivityIndicator color="#FFFFFF" size="small" />
      ) : (
        <>
          <Text
            style={[
              styles.text,
              isDisabled && styles.disabledText,
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
          activeOpacity={0.85}
          onPress={onPress}
          disabled={isDisabled}
          style={[
            styles.touchable,
            styles.primaryButton,
            isDisabled && styles.primaryButtonDisabled,
          ]}
        >
          {renderContent()}
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
  primaryButton: {
    backgroundColor: colors.primaryButton ?? '#6338F2',
    borderWidth: 1,
    borderColor: colors.primaryButtonBorder ?? '#7C5CFF',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.primaryButtonDisabled ?? '#1C1635',
    borderColor: colors.primaryButtonDisabledBorder ?? '#2E2452',
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
    opacity: 0.65,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  disabledText: {
    color: colors.primaryButtonTextDisabled ?? '#5E5380',
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
