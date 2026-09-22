import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  BackHandler,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { RootStackParamList, Leg, UpiAppInfo } from '../types';
import {
  useSessionStore,
  selectPaidPaise,
  selectRemainingPaise,
  selectDoneCount,
  selectTotalCount,
  selectNextPendingLeg,
} from '../store/sessionStore';
import { buildUpiUri, maskVpa } from '../domain/upi';
import {
  getUpiIntent,
} from '../native/upiIntent';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { ProgressBar } from '../components/ProgressBar';
import { BackButton } from '../components/BackButton';
import { formatIndianCurrency } from '../components/AmountText';
import { CustomModal, CustomModalButton } from '../components/CustomModal';
import { AppIcon } from '../components/AppIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'Pay'>;

type ThemedDialogState = {
  visible: boolean;
  icon?: string;
  iconType?: 'danger' | 'warning' | 'info' | 'success';
  title: string;
  message?: string;
  primaryButton?: CustomModalButton;
  secondaryButton?: CustomModalButton;
};

type LegRowItemProps = {
  leg: Leg;
  index: number;
  isNext: boolean;
  onRetry: () => void;
  onResolveUnknown: (legIndex: number, didSucceed: boolean) => void;
};

const LegRowItem = React.memo<LegRowItemProps>(({
  leg,
  index,
  isNext,
  onRetry,
  onResolveUnknown,
}) => {
  const legAmount = formatIndianCurrency(leg?.amountPaise ?? 0);
  return (
    <GlassCard
      style={[
        styles.legRow,
        isNext && styles.activeLegRow,
        leg?.status === 'success' && styles.successLegRow,
        leg?.status === 'failed' && styles.failedLegRow,
      ]}
    >
      <View style={styles.legMainContent}>
        <View style={styles.legLeft}>
          <View style={styles.legIndexPill}>
            <Text style={styles.legIndexText}>#{index + 1}</Text>
          </View>
          <View>
            <Text style={styles.legAmount}>
              ₹{legAmount.rupeePart}.{legAmount.decimalPart}
            </Text>
            {leg?.status === 'success' && leg?.txnId ? (
              <Text style={styles.legRefText} numberOfLines={1}>
                Ref: {leg.txnId} {leg.approvalRef ? `• Appr: ${leg.approvalRef}` : ''}
              </Text>
            ) : (
              <Text style={styles.legStatusLabel}>
                {leg?.status === 'pending'
                  ? 'Pending'
                  : leg?.status === 'in_progress'
                  ? 'Opening UPI App...'
                  : leg?.status === 'success'
                  ? 'Paid'
                  : leg?.status === 'failed'
                  ? 'Failed'
                  : 'Verification Needed'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.legRight}>
          {leg?.status === 'pending' && <View style={styles.pendingDot} />}
          {leg?.status === 'in_progress' && <View style={styles.inProgressDot} />}
          {leg?.status === 'success' && <Text style={styles.statusSuccessIcon}>✓</Text>}
          {leg?.status === 'failed' && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onRetry}
              style={styles.retryBadge}
            >
              <Text style={styles.retryBadgeText}>Retry ↺</Text>
            </TouchableOpacity>
          )}
          {leg?.status === 'unknown' && <Text style={styles.statusUnknownIcon}>?</Text>}
        </View>
      </View>

      {/* Unknown Resolution Prompt */}
      {leg?.status === 'unknown' && (
        <View style={styles.unknownPromptBox}>
          <Text style={styles.unknownPromptText}>
            Did this payment go through in your UPI app?
          </Text>
          <View style={styles.unknownButtonsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onResolveUnknown(leg.index, true)}
              style={[styles.unknownBtn, styles.unknownYesBtn]}
            >
              <Text style={styles.unknownYesText}>Yes, Succeeded</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onResolveUnknown(leg.index, false)}
              style={[styles.unknownBtn, styles.unknownNoBtn]}
            >
              <Text style={styles.unknownNoText}>No, Failed</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </GlassCard>
  );
});
export const PayScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  // Atomic Zustand state selectors (re-renders only when the respective field changes)
  const paidPaise = useSessionStore(selectPaidPaise);
  const remainingPaise = useSessionStore(selectRemainingPaise);
  const doneCount = useSessionStore(selectDoneCount);
  const totalCount = useSessionStore(selectTotalCount);
  const nextPendingLeg = useSessionStore(selectNextPendingLeg);
  const legs = useSessionStore((state) => state.legs);
  const totalPaise = useSessionStore((state) => state.totalPaise);
  const payeeVpa = useSessionStore((state) => state.payeeVpa);
  const payeeName = useSessionStore((state) => state.payeeName);
  const merchantCode = useSessionStore((state) => state.merchantCode);
  const transactionNote = useSessionStore((state) => state.transactionNote);
  const signature = useSessionStore((state) => state.signature);
  const mode = useSessionStore((state) => state.mode);
  const inFlight = useSessionStore((state) => state.inFlight);
  const cooldownUntil = useSessionStore((state) => state.cooldownUntil);
  const lastUsedPackage = useSessionStore((state) => state.lastUsedPackage);

  const startLeg = useSessionStore((state) => state.startLeg);
  const completeLeg = useSessionStore((state) => state.completeLeg);
  const failLeg = useSessionStore((state) => state.failLeg);
  const markLegUnknown = useSessionStore((state) => state.markLegUnknown);
  const resolveUnknownLeg = useSessionStore((state) => state.resolveUnknownLeg);
  const setLastUsedPackage = useSessionStore((state) => state.setLastUsedPackage);

  const [appsSheetVisible, setAppsSheetVisible] = useState(false);
  const [installedApps, setInstalledApps] = useState<UpiAppInfo[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number | null>(null);

  const [dialog, setDialog] = useState<ThemedDialogState>({ visible: false, title: '' });
  const showThemedDialog = useCallback((config: Omit<ThemedDialogState, 'visible'>) => {
    setDialog({ ...config, visible: true });
  }, []);
  const closeDialog = useCallback(() => setDialog((prev) => ({ ...prev, visible: false })), []);

  // Abandon confirm dialog per Section 4.5 & 9.32
  const handleAbandon = useCallback(() => {
    if (doneCount === 0) {
      showThemedDialog({
        iconType: 'warning',
        title: 'Cancel Payment?',
        message: 'No payments have been made. Do you want to cancel this payment session?',
        primaryButton: {
          text: 'Cancel Session',
          destructive: true,
          onPress: () => {
            closeDialog();
            try {
              useSessionStore.getState()?.resetSession?.();
              navigation?.reset?.({ index: 0, routes: [{ name: 'Scanner' }] });
            } catch (err: unknown) {
              console.warn('[PayScreen] Reset navigation error:', err);
            }
          },
        },
        secondaryButton: {
          text: 'Resume',
          onPress: closeDialog,
        },
      });
      return;
    }

    showThemedDialog({
      iconType: 'danger',
      title: 'Abandon Payment Session?',
      message:
        'Already completed payments are final and cannot be reversed by NoFeePe. If you abandon now, your partial payment receipt will be generated for completed payments.',
      primaryButton: {
        text: 'Abandon & View Receipt',
        destructive: true,
        onPress: () => {
          closeDialog();
          try {
            navigation?.navigate?.('Success', { partial: true });
          } catch (err: unknown) {
            console.warn('[PayScreen] Navigation to Partial Success error:', err);
          }
        },
      },
      secondaryButton: {
        text: 'Resume Payment',
        onPress: closeDialog,
      },
    });
  }, [closeDialog, doneCount, navigation, showThemedDialog]);

  // Intercept hardware back button per Section 9.38
  useEffect(() => {
    const onBackPress = () => {
      try {
        if (doneCount > 0) {
          handleAbandon();
          return true;
        }
      } catch (err: unknown) {
        console.warn('[PayScreen] onBackPress error:', err);
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [doneCount, handleAbandon]);

  // 3-second cooldown countdown timer per Section 4.5 (runs only when cooldown is active)
  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownRemaining(null);
      return;
    }
    const updateCooldown = () => {
      const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (remaining > 0) {
        setCooldownRemaining(remaining);
      } else {
        setCooldownRemaining(null);
      }
    };
    updateCooldown();
    const interval = setInterval(updateCooldown, 250);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  // Load available UPI apps via Android PackageManager
  const loadApps = useCallback(async () => {
    setLoadingApps(true);
    try {
      const apps = await getUpiIntent().listUpiApps();
      setInstalledApps(apps ?? []);
    } catch (err: unknown) {
      console.warn('[PayScreen] Failed to list UPI apps:', err);
      setInstalledApps([]);
    } finally {
      setLoadingApps(false);
    }
  }, []);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  const triggerHaptic = (type: 'impactMedium' | 'notificationSuccess' | 'impactHeavy') => {
    try {
      ReactNativeHapticFeedback.trigger(type, { enableVibrateFallback: true });
    } catch (err: unknown) {
      console.debug?.('[PayScreen] Haptic error:', err);
    }
  };

  // Open App Picker Sheet
  const handlePressPay = useCallback(() => {
    if (!nextPendingLeg || inFlight || (cooldownRemaining && cooldownRemaining > 0)) {
      return;
    }
    loadApps();
    setAppsSheetVisible(true);
  }, [nextPendingLeg, inFlight, cooldownRemaining, loadApps]);

  // Execute payment leg with chosen app
  const executePaymentLeg = async (selectedApp: UpiAppInfo) => {
    if (!nextPendingLeg) return;
    setAppsSheetVisible(false);

    const legIndex = nextPendingLeg.index;
    setLastUsedPackage(selectedApp.packageName);
    startLeg(legIndex, selectedApp.packageName, selectedApp.label);

    try {
      // Build URI per Section 6.2 with fresh unique tr and session immutability check
      const paymentUri = buildUpiUri({
        payeeVpa: payeeVpa ?? '',
        originalVpa: payeeVpa ?? '',
        payeeName: payeeName ?? null,
        amountPaise: nextPendingLeg.amountPaise,
        transactionNote: transactionNote || `Leg ${legIndex + 1} of ${totalCount}`,
        merchantCode: merchantCode ?? null,
        signature: mode === 'direct' ? (signature ?? null) : null,
      });

      const result = await getUpiIntent().pay(paymentUri, selectedApp.packageName);

      // Section 9: Handling payment results
      switch (result?.status) {
        case 'SUCCESS': {
          completeLeg(
            legIndex,
            result.txnId,
            result.approvalRef,
            result.raw,
            selectedApp.packageName,
            selectedApp.label
          );
          const isFinalLeg = doneCount + 1 >= totalCount;
          triggerHaptic(isFinalLeg ? 'impactHeavy' : 'notificationSuccess');

          if (isFinalLeg) {
            setTimeout(() => {
              try {
                navigation?.navigate?.('Success', { partial: false });
              } catch (navErr: unknown) {
                console.warn('[PayScreen] Navigation to Success error:', navErr);
              }
            }, 600);
          }
          break;
        }

        case 'FAILURE': {
          failLeg(legIndex);
          showThemedDialog({
            iconType: 'danger',
            title: 'Payment Failed',
            message: 'Transaction failed or bank limit reached. You can tap Retry on this row.',
            primaryButton: { text: 'Got It', onPress: closeDialog },
          });
          break;
        }

        case 'PENDING':
        case 'UNKNOWN': {
          // Dangerous case per Section 9.26: Never auto-advance or mark success
          markLegUnknown(legIndex, result?.raw);
          break;
        }

        case 'CANCELLED': {
          // User backed out: leg stays pending with no penalty per Section 9.27
          failLeg(legIndex);
          useSessionStore.setState((s) => {
            const updatedLegs = [...(s?.legs ?? [])];
            if (updatedLegs[legIndex]) {
              updatedLegs[legIndex].status = 'pending';
            }
            return { legs: updatedLegs, inFlight: false };
          });
          break;
        }
      }
    } catch (err: unknown) {
      failLeg(legIndex);
      const errMsg = err instanceof Error ? err.message : 'Unable to launch UPI app.';
      showThemedDialog({
        iconType: 'danger',
        title: 'Payment Error',
        message: errMsg,
        primaryButton: { text: 'Dismiss', onPress: closeDialog },
      });
    }
  };

  const handlePause = () => {
    showThemedDialog({
      iconType: 'info',
      title: 'Session Paused',
      message:
        'You can resume anytime while the app is active. Please complete remaining payments to avoid pending merchant orders.',
      primaryButton: { text: 'Resume', onPress: closeDialog },
    });
  };

  const handleResolveUnknown = (legIndex: number, didSucceed: boolean) => {
    try {
      resolveUnknownLeg(legIndex, didSucceed);
      if (didSucceed) {
        const isFinal = doneCount + 1 >= totalCount;
        triggerHaptic(isFinal ? 'impactHeavy' : 'notificationSuccess');
        if (isFinal) {
          setTimeout(() => {
            navigation?.navigate?.('Success', { partial: false });
          }, 600);
        }
      }
    } catch (err: unknown) {
      console.warn('[PayScreen] handleResolveUnknown error:', err);
    }
  };

  // Sort available UPI apps alphabetically (A–Z) by display label, pinned last used app at top
  const sortedApps = useMemo(() => {
    try {
      return [...(installedApps ?? [])].sort((a, b) => {
        if (a?.packageName === lastUsedPackage) return -1;
        if (b?.packageName === lastUsedPackage) return 1;
        const labelA = a?.label ?? '';
        const labelB = b?.label ?? '';
        return labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
      });
    } catch {
      return installedApps ?? [];
    }
  }, [installedApps, lastUsedPackage]);

  const paidFormatted = useMemo(() => formatIndianCurrency(paidPaise), [paidPaise]);
  const totalFormatted = useMemo(() => formatIndianCurrency(totalPaise ?? 0), [totalPaise]);
  const remainingFormatted = useMemo(() => formatIndianCurrency(remainingPaise), [remainingPaise]);
  const progressFraction = (totalPaise ?? 0) > 0 ? paidPaise / totalPaise : 0;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.sm,
          paddingBottom: Math.max(insets.bottom, 16) + spacing.xs,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={handleAbandon} />
        <Text style={styles.headerTitle}>
          {mode === 'split' ? 'Split & Pay Tracker' : 'Direct Payment'}
        </Text>
        <View style={styles.backPlaceholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Payee Glass Card */}
        <GlassCard style={styles.payeeCard}>
          <View style={styles.payeeRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {payeeName ? payeeName.charAt(0).toUpperCase() : '₹'}
              </Text>
            </View>
            <View style={styles.payeeInfo}>
              <Text style={styles.payeeName} numberOfLines={1}>
                {payeeName || 'UPI Merchant'}
              </Text>
              <Text style={styles.payeeVpa}>{maskVpa(payeeVpa ?? '')}</Text>
            </View>
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>
                {mode === 'split' ? 'SPLIT' : 'DIRECT'}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* Progress Block per Section 4.5 */}
        <GlassCard elevated style={styles.progressCard}>
          <View style={styles.progressTextRow}>
            <Text style={styles.progressPaidText}>
              ₹{paidFormatted.rupeePart}.{paidFormatted.decimalPart} of ₹
              {totalFormatted.rupeePart}.{totalFormatted.decimalPart} paid
            </Text>
            <Text style={styles.progressCountText}>
              {doneCount} of {totalCount} done
            </Text>
          </View>

          <View style={styles.progressBarWrapper}>
            <ProgressBar progress={progressFraction} />
          </View>

          <View style={styles.progressBottomRow}>
            <Text style={styles.remainingText}>
              ₹{remainingFormatted.rupeePart}.{remainingFormatted.decimalPart} remaining
            </Text>
            {mode === 'split' && (
              <Text style={styles.subCapTag}>Capped at ₹1,999/leg</Text>
            )}
          </View>
        </GlassCard>

        {/* Leg Installment List */}
        <View style={styles.legsListSection}>
          <Text style={styles.sectionHeader}>
            {mode === 'split' ? 'PAYMENT INSTALMENTS' : 'PAYMENT DETAILS'}
          </Text>

          {(legs ?? []).map((leg: Leg, index: number) => (
            <LegRowItem
              key={leg?.index ?? index}
              leg={leg}
              index={index}
              isNext={nextPendingLeg?.index === leg?.index}
              onRetry={handlePressPay}
              onResolveUnknown={handleResolveUnknown}
            />
          ))}
        </View>
      </ScrollView>

      {/* Primary Action Button & Secondary Controls */}
      <View style={styles.footer}>
        {nextPendingLeg ? (
          <GradientButton
            label={`Pay ₹${(nextPendingLeg.amountPaise / 100).toFixed(2)}`}
            onPress={handlePressPay}
            disabled={inFlight || (cooldownRemaining !== null && cooldownRemaining > 0)}
            cooldownSeconds={cooldownRemaining}
            variant="primary"
          />
        ) : (
          <GradientButton
            label="View Receipt"
            onPress={() => {
              try {
                navigation?.navigate?.('Success', { partial: false });
              } catch (err: unknown) {
                console.warn('[PayScreen] Navigate to Success error:', err);
              }
            }}
            variant="primary"
          />
        )}

        <View style={styles.secondaryActions}>
          <TouchableOpacity activeOpacity={0.7} onPress={handlePause} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Pause</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.7} onPress={handleAbandon} style={styles.secondaryButton}>
            <Text style={[styles.secondaryButtonText, styles.abandonText]}>Abandon</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* UPI App Selection Bottom Sheet */}
      <Modal
        visible={appsSheetVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAppsSheetVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <View
            style={[
              styles.sheetCard,
              { paddingBottom: Math.max(insets.bottom, 20) + spacing.md },
            ]}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Choose UPI App</Text>
                <Text style={styles.sheetSubtitle}>
                  {nextPendingLeg
                    ? `Paying ₹${(nextPendingLeg.amountPaise / 100).toFixed(2)} for Leg ${
                        nextPendingLeg.index + 1
                      }`
                    : 'Select app to proceed'}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setAppsSheetVisible(false)}
                style={styles.sheetCloseButton}
              >
                <Text style={styles.sheetCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingApps ? (
              <View style={styles.sheetLoading}>
                <Text style={styles.sheetLoadingText}>Detecting installed UPI apps...</Text>
              </View>
            ) : sortedApps.length === 0 ? (
              <View style={styles.emptyAppsContainer}>
                <View style={styles.emptyAppsIconWrapper}>
                  <AppIcon name="warning" size={32} color="#F59E0B" />
                </View>
                <Text style={styles.emptyAppsTitle}>No UPI Apps Found</Text>
                <Text style={styles.emptyAppsSubtitle}>
                  Please install a UPI app (Google Pay, PhonePe, Paytm, BHIM) to complete payments.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.appsList} bounces={false}>
                {sortedApps.map((app) => {
                  const isPinned = app?.packageName === lastUsedPackage;
                  return (
                    <TouchableOpacity
                      key={app?.packageName}
                      activeOpacity={0.75}
                      onPress={() => executePaymentLeg(app)}
                      style={[styles.appItem, isPinned && styles.pinnedAppItem]}
                    >
                      <View style={styles.appItemLeft}>
                        {app?.iconBase64 ? (
                          <Image
                            source={{ uri: app.iconBase64 }}
                            style={styles.installedAppIcon}
                            resizeMode="contain"
                          />
                        ) : (
                          <View
                            style={[
                              styles.appColorDot,
                              { backgroundColor: (app?.brandColor || colors?.accentStart) ?? '#00F5A0' },
                            ]}
                          />
                        )}
                        <View>
                          <Text style={styles.appLabel}>{app?.label}</Text>
                          {isPinned && <Text style={styles.pinnedLabel}>Last used</Text>}
                        </View>
                      </View>
                      <Text style={styles.appPayArrow}>→</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Themed Custom Modal */}
      <CustomModal
        visible={dialog.visible}
        icon={dialog.icon}
        iconType={dialog.iconType}
        title={dialog.title}
        message={dialog.message}
        primaryButton={dialog.primaryButton}
        secondaryButton={dialog.secondaryButton}
        onDismiss={closeDialog}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070B',
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...typography.headingSm,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  backPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  payeeCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  payeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 245, 160, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.headingSm,
    color: colors?.textPurpleLight ?? '#C4B5FD',
    fontWeight: '700',
    fontSize: 16,
  },
  payeeInfo: {
    flex: 1,
  },
  payeeName: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
  },
  payeeVpa: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  modeBadge: {
    backgroundColor: 'rgba(0, 217, 245, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii?.pill ?? 9999,
  },
  modeBadgeText: {
    ...typography.caption,
    fontSize: 10,
    color: colors?.accentEnd ?? '#00D9F5',
    fontWeight: '800',
  },
  progressCard: {
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  progressPaidText: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  progressCountText: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 12,
  },
  progressBarWrapper: {
    marginVertical: spacing.xs,
  },
  progressBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  remainingText: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 12,
  },
  subCapTag: {
    ...typography.caption,
    fontSize: 10,
    color: colors?.textPurpleLight ?? '#C4B5FD',
    fontWeight: '600',
  },
  legsListSection: {
    gap: spacing.sm,
  },
  sectionHeader: {
    ...typography.captionMedium,
    color: colors?.textMuted ?? '#8E92A8',
    letterSpacing: 1.2,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  legRow: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors?.glassBorder ?? 'rgba(255, 255, 255, 0.08)',
  },
  activeLegRow: {
    borderColor: colors?.accentEnd ?? '#00D9F5',
    backgroundColor: 'rgba(0, 217, 245, 0.04)',
  },
  successLegRow: {
    borderColor: 'rgba(0, 245, 160, 0.25)',
  },
  failedLegRow: {
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  legMainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  legIndexPill: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legIndexText: {
    ...typography.caption,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
  },
  legAmount: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  legRefText: {
    ...typography.caption,
    color: colors?.textPurpleLight ?? '#C4B5FD',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
    maxWidth: 200,
  },
  legStatusLabel: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 12,
    marginTop: 1,
  },
  legRight: {
    alignItems: 'flex-end',
  },
  pendingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors?.textFaint ?? '#5A5F73',
  },
  inProgressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors?.accentEnd ?? '#00D9F5',
  },
  statusSuccessIcon: {
    color: colors?.success ?? '#2BD9A0',
    fontSize: 18,
    fontWeight: '800',
  },
  statusUnknownIcon: {
    color: colors?.warning ?? '#FFB020',
    fontSize: 18,
    fontWeight: '800',
  },
  retryBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii?.pill ?? 9999,
  },
  retryBadgeText: {
    ...typography.caption,
    color: colors?.danger ?? '#EF4444',
    fontWeight: '700',
    fontSize: 11,
  },
  unknownPromptBox: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  unknownPromptText: {
    ...typography.body,
    color: colors?.warning ?? '#FFB020',
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  unknownButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  unknownBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii?.button ?? 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unknownYesBtn: {
    backgroundColor: 'rgba(0, 245, 160, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.3)',
  },
  unknownYesText: {
    ...typography.caption,
    color: colors?.success ?? '#2BD9A0',
    fontWeight: '700',
  },
  unknownNoBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  unknownNoText: {
    ...typography.caption,
    color: colors?.danger ?? '#EF4444',
    fontWeight: '700',
  },
  footer: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.xs,
  },
  secondaryButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    ...typography.bodyMedium,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 14,
  },
  abandonText: {
    color: colors?.danger ?? '#EF4444',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 5, 8, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#13141F',
    borderTopLeftRadius: radii?.card ?? 24,
    borderTopRightRadius: radii?.card ?? 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors?.glassBorder ?? 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '75%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.headingSm,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  sheetSubtitle: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    marginTop: 2,
  },
  sheetCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetCloseText: {
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 12,
  },
  sheetLoading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  sheetLoadingText: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
  },
  emptyAppsContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyAppsIconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyAppsTitle: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptyAppsSubtitle: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    textAlign: 'center',
  },
  appsList: {
    marginVertical: spacing.xs,
  },
  appItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii?.row ?? 12,
    marginBottom: spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  pinnedAppItem: {
    backgroundColor: 'rgba(0, 245, 160, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.2)',
  },
  appItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  appColorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  installedAppIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  appLabel: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  pinnedLabel: {
    ...typography.caption,
    color: colors?.textPurpleLight ?? '#C4B5FD',
    fontSize: 11,
    marginTop: 1,
  },
  appPayArrow: {
    ...typography.bodyMedium,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 18,
  },
});
