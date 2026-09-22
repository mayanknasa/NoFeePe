import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, radii, spacing } from '../theme/tokens';
import { AppIcon } from './AppIcon';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global App Error Boundary.
 * Catches any unhandled render-phase errors in the React component hierarchy
 * and presents an app-themed recovery screen, guaranteeing zero fatal app crashes.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error details safely for debugging without breaking execution
    try {
      console.warn('[ErrorBoundary] Uncaught component error:', error?.message, errorInfo?.componentStack);
    } catch {
      // Prevent logging itself from throwing
    }
  }

  private handleReset = (): void => {
    try {
      this.setState({ hasError: false, error: null });
    } catch {
      // Prevent reset failure
    }
  };

  public render(): ReactNode {
    if (this.state?.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <AppIcon name="shield" size={28} color="#EF4444" />
            </View>

            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              {this.state.error?.message ?? 'An unexpected error occurred. Your session and device are safe.'}
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={this.handleReset}
              style={styles.buttonWrapper}
            >
              <View style={styles.solidButton}>
                <Text style={styles.buttonText}>Restart Screen</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props?.children ?? null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#13141F',
    borderWidth: 1,
    borderColor: '#2A2B3D',
    borderRadius: radii.card,
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.headingSm,
    color: '#FFFFFF',
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
  buttonWrapper: {
    width: '100%',
    borderRadius: radii.button,
    overflow: 'hidden',
  },
  solidButton: {
    backgroundColor: colors.primaryButton ?? '#6338F2',
    borderWidth: 1,
    borderColor: colors.primaryButtonBorder ?? '#7C5CFF',
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.button,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
