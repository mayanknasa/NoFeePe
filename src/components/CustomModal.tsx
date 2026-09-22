import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { colors, typography, radii, spacing } from '../theme';
import { AppIcon } from './AppIcon';

/**
 * Action button configuration for the CustomModal component.
 */
export type CustomModalButton = {
  text: string;
  onPress: () => void;
  destructive?: boolean;
};

/**
 * Props for CustomModal.
 */
export type CustomModalProps = {
  visible: boolean;
  icon?: string | React.ReactNode;
  iconType?: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  message?: string;
  primaryButton?: CustomModalButton;
  secondaryButton?: CustomModalButton;
  onDismiss?: () => void;
  children?: React.ReactNode;
};

/**
 * App-Themed Glassmorphism Modal Component.
 * Replaces default OS alerts and system dialogs across the entire application.
 * Styled with `#090A0F` dark glass backdrop, `#13141F` card surface,
 * subtle border highlight, status icon badge, and solid dark blue action buttons.
 */
export const CustomModal: React.FC<CustomModalProps> = ({
  visible,
  icon,
  iconType = 'info',
  title,
  message,
  primaryButton,
  secondaryButton,
  onDismiss,
  children,
}) => {
  if (!visible) return null;

  const getIconBadgeStyle = () => {
    switch (iconType) {
      case 'danger':
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
        };
      case 'warning':
        return {
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          borderColor: 'rgba(245, 158, 11, 0.3)',
        };
      case 'success':
        return {
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
        };
      case 'info':
      default:
        return {
          backgroundColor: 'rgba(34, 211, 238, 0.12)',
          borderColor: 'rgba(34, 211, 238, 0.3)',
        };
    }
  };

  const renderIcon = () => {
    if (React.isValidElement(icon)) {
      return icon;
    }
    switch (iconType) {
      case 'danger':
        return <AppIcon name="cross" size={24} color="#EF4444" />;
      case 'warning':
        return <AppIcon name="warning" size={24} color="#F59E0B" />;
      case 'success':
        return <AppIcon name="check" size={24} color="#10B981" />;
      case 'info':
      default:
        return <AppIcon name="info" size={24} color="#38BDF8" />;
    }
  };

  const handlePrimaryPress = () => {
    try {
      primaryButton?.onPress?.();
    } catch (err: unknown) {
      console.warn('[CustomModal] primaryButton onPress error:', err);
    }
  };

  const handleSecondaryPress = () => {
    try {
      secondaryButton?.onPress?.();
    } catch (err: unknown) {
      console.warn('[CustomModal] secondaryButton onPress error:', err);
    }
  };

  const handleDismiss = () => {
    try {
      onDismiss?.();
    } catch (err: unknown) {
      console.warn('[CustomModal] onDismiss error:', err);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.dialogCard}>
              <View style={[styles.iconContainer, getIconBadgeStyle()]}>
                {renderIcon()}
              </View>

              <Text style={styles.title}>{title}</Text>
              {message ? <Text style={styles.message}>{message}</Text> : null}

              {children}

              <View style={styles.buttonContainer}>
                {primaryButton && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handlePrimaryPress}
                    style={styles.primaryButton}
                  >
                    <View
                      style={[
                        styles.solidPrimaryButtonBg,
                        primaryButton?.destructive && styles.destructiveButtonBg,
                      ]}
                    >
                      <Text style={styles.primaryButtonText}>{primaryButton?.text}</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {secondaryButton && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={handleSecondaryPress}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>{secondaryButton?.text}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 5, 8, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#13141F',
    borderWidth: 1,
    borderColor: '#2A2B3D',
    borderRadius: radii?.card ?? 24,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.headingSm,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    ...typography.body,
    color: '#8E92A8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  buttonContainer: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  primaryButton: {
    width: '100%',
    borderRadius: radii?.button ?? 14,
    overflow: 'hidden',
  },
  solidPrimaryButtonBg: {
    backgroundColor: colors?.primaryButton ?? '#6338F2',
    borderWidth: 1,
    borderColor: colors?.primaryButtonBorder ?? '#7C5CFF',
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii?.button ?? 14,
  },
  destructiveButtonBg: {
    backgroundColor: '#991B1B',
    borderColor: '#DC2626',
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  secondaryButton: {
    width: '100%',
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.bodyMedium,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 14,
    fontWeight: '500',
  },
});
