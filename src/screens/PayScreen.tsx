import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Modal,
  Alert,
  BackHandler,
} from 'react-native';
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
  isMockEnabled,
  setMockEnabled,
  mockUpiIntent,
} from '../native/upiIntent';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { ProgressBar } from '../components/ProgressBar';
import { formatIndianCurrency } from '../components/AmountText';

type Props = NativeStackScreenProps<RootStackParamList, 'Pay'>;

export const PayScreen: React.FC<Props> = ({ navigation }) => {
  const session = useSessionStore();
  const {
    startLeg,
    completeLeg,
    failLeg,
    markLegUnknown,
    resolveUnknownLeg,
    setLastUsedPackage,
    setInFlight,
  } = useSessionStore();

  const paidPaise = useMemo(() => selectPaidPaise(session), [session]);
  const remainingPaise = useMemo(() => selectRemainingPaise(session), [session]);
  const doneCount = useMemo(() => selectDoneCount(session), [session]);
  const totalCount = useMemo(() => selectTotalCount(session), [session]);
  const nextPendingLeg = useMemo(() => selectNextPendingLeg(session), [session]);

  const [appsSheetVisible, setAppsSheetVisible] = useState(false);
  const [installedApps, setInstalledApps] = useState<UpiAppInfo[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number | null>(null);
  const [mockDevMode, setMockDevMode] = useState<boolean>(isMockEnabled());

  // Hardware Back Button interception per Section 9.38
  useEffect(() => {
    const onBackPress = () => {
      if (doneCount > 0) {
        handleAbandon();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [doneCount]);

  // 3-second Cooldown countdown timer per Section 4.5
  useEffect(() => {
    const interval = setInterval(() => {
      if (session.cooldownUntil) {
        const remaining = Math.ceil((session.cooldownUntil - Date.now()) / 1000);
        if (remaining > 0) {
          setCooldownRemaining(remaining);
        } else {
          setCooldownRemaining(null);
        }
      } else {
        setCooldownRemaining(null);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [session.cooldownUntil]);

  // Load available UPI apps
  const loadApps = useCallback(async () => {
    setLoadingApps(true);
    try {
      const apps = await getUpiIntent().listUpiApps();
      setInstalledApps(apps);
    } catch {
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
    } catch {}
  };

  // Open App Picker Sheet
  const handlePressPay = () => {
    if (!nextPendingLeg || session.inFlight || (cooldownRemaining && cooldownRemaining > 0)) {
      return;
    }
    loadApps();
    setAppsSheetVisible(true);
  };

  // Execute payment leg with chosen app
  const executePaymentLeg = async (selectedApp: UpiAppInfo) => {
    if (!nextPendingLeg) return;
    setAppsSheetVisible(false);

    const legIndex = nextPendingLeg.index;
    setLastUsedPackage(selectedApp.packageName);
    startLeg(legIndex);

    try {
      // Build URI per Section 6.2 with fresh unique tr and immutability check
      const paymentUri = buildUpiUri({
        payeeVpa: session.payeeVpa,
        originalVpa: session.payeeVpa,
        payeeName: session.payeeName,
        amountPaise: nextPendingLeg.amountPaise,
        transactionNote: session.transactionNote || `Leg ${legIndex + 1} of ${totalCount}`,
        merchantCode: session.merchantCode,
        signature: session.mode === 'direct' ? session.signature : null,
      });

      const result = await getUpiIntent().pay(paymentUri, selectedApp.packageName);

      // Section 9: Handling payment results
      switch (result.status) {
        case 'SUCCESS': {
          completeLeg(legIndex, result.txnId, result.approvalRef, result.raw);
          const isFinalLeg = doneCount + 1 >= totalCount;
          triggerHaptic(isFinalLeg ? 'impactHeavy' : 'notificationSuccess');

          if (isFinalLeg) {
            setTimeout(() => {
              navigation.navigate('Success', { partial: false });
            }, 600);
          }
          break;
        }

        case 'FAILURE': {
          failLeg(legIndex);
          Alert.alert(
            'Payment Failed',
            'Transaction failed or bank limit reached. You can tap Retry on this row.',
            [{ text: 'OK' }]
          );
          break;
        }

        case 'PENDING':
        case 'UNKNOWN': {
          // Dangerous case per Section 9.26: Never auto-advance or mark success
          markLegUnknown(legIndex, result.raw);
          break;
        }

        case 'CANCELLED': {
          // User backed out. Leg stays pending, no penalty per Section 9.27
          failLeg(legIndex); // or return to pending
          useSessionStore.setState((s) => {
            const legs = [...s.legs];
            legs[legIndex].status = 'pending';
            return { legs, inFlight: false };
          });
          break;
        }
      }
    } catch (err: any) {
      failLeg(legIndex);
      Alert.alert('Payment Error', err.message || 'Unable to launch UPI app.');
    }
  };

  // Abandon confirm dialog per Section 4.5 & 9.32
  const handleAbandon = () => {
    Alert.alert(
      'Abandon Payment Session?',
      'Already completed payments are final and cannot be reversed by noFeePe. If you abandon now, your partial payment receipt will be generated.',
      [
        { text: 'Resume Payment', style: 'cancel' },
        {
          text: 'Abandon & View Receipt',
          style: 'destructive',
          onPress: () => {
            navigation.navigate('Success', { partial: true });
          },
        },
      ]
    );
  };

  const handlePause = () => {
    Alert.alert(
      'Session Paused',
      'You can resume anytime while the app is active. Please complete remaining payments to avoid pending merchant orders.',
      [{ text: 'Resume' }]
    );
  };

  const paidFormatted = formatIndianCurrency(paidPaise);
  const totalFormatted = formatIndianCurrency(session.totalPaise);
  const remainingFormatted = formatIndianCurrency(remainingPaise);
  const progressPercent = session.totalPaise > 0 ? paidPaise / session.totalPaise : 0;

  // Sorted apps: pinned last used app at top per Section 4.5
  const sortedApps = useMemo(() => {
    if (!session.lastUsedPackage) return installedApps;
    return [...installedApps].sort((a, b) => {
      if (a.packageName === session.lastUsedPackage) return -1;
      if (b.packageName === session.lastUsedPackage) return 1;
      return 0;
    });
  }, [installedApps, session.lastUsedPackage]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={doneCount > 0 ? handleAbandon : () => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              {session.mode === 'split' ? 'Split & Pay Tracker' : 'Direct Payment'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {doneCount} of {totalCount} payments done
            </Text>
          </View>

          {/* Dev Mock Toggle Button */}
          {__DEV__ && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                const next = !mockDevMode;
                setMockDevMode(next);
                setMockEnabled(next);
                Alert.alert(
                  'Mock Mode Toggled',
                  next
                    ? 'Mock UPI enabled: simulated payments will succeed without real money.'
                    : 'Real UPI enabled: will invoke installed UPI apps.'
                );
              }}
              style={[styles.mockToggle, mockDevMode && styles.mockToggleActive]}
            >
              <Text style={styles.mockToggleText}>{mockDevMode ? 'MOCK' : 'REAL'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Payee Card with Masked VPA */}
          <GlassCard style={styles.payeeCard}>
            <View style={styles.payeeRow}>
              <View style={styles.merchantAvatar}>
                <Text style={styles.merchantAvatarText}>🏬</Text>
              </View>
              <View style={styles.payeeInfo}>
                <Text numberOfLines={1} style={styles.payeeName}>
                  {session.payeeName || 'Merchant'}
                </Text>
                <Text style={styles.payeeVpa}>{maskVpa(session.payeeVpa)}</Text>
              </View>
              <View style={styles.badgeActive}>
                <Text style={styles.badgeActiveText}>Active</Text>
              </View>
            </View>
          </GlassCard>

          {/* Progress Block per Section 4.5 */}
          <GlassCard elevated style={styles.progressCard}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.progressMainText}>
                ₹{paidFormatted.rupeePart}.{paidFormatted.decimalPart}
                <Text style={styles.progressSubText}> of ₹{totalFormatted.rupeePart}.{totalFormatted.decimalPart} paid</Text>
              </Text>
              <Text style={styles.percentText}>
                {Math.round(progressPercent * 100)}%
              </Text>
            </View>

            {/* Reanimated Animated Progress Bar */}
            <ProgressBar
              progress={progressPercent}
              segmented={session.mode === 'split'}
              totalSegments={totalCount}
              completedSegments={doneCount}
              style={styles.progressBar}
            />

            <View style={styles.progressFooterRow}>
              <Text style={styles.remainingText}>
                ₹{remainingFormatted.rupeePart}.{remainingFormatted.decimalPart} remaining
              </Text>
              <Text style={styles.countText}>
                {doneCount} of {totalCount} payments done
              </Text>
            </View>
          </GlassCard>

          {/* Leg List per Section 4.5 */}
          <View style={styles.legListContainer}>
            <Text style={styles.legListHeader}>SEQUENTIAL INSTALMENTS</Text>

            {session.legs.map((leg) => {
              const legFormatted = formatIndianCurrency(leg.amountPaise);
              const isPending = leg.status === 'pending';
              const isInProgress = leg.status === 'in_progress';
              const isSuccess = leg.status === 'success';
              const isFailed = leg.status === 'failed';
              const isUnknown = leg.status === 'unknown';

              return (
                <GlassCard
                  key={leg.index}
                  style={[
                    styles.legRow,
                    isSuccess && styles.legRowSuccess,
                    isFailed && styles.legRowFailed,
                    isUnknown && styles.legRowUnknown,
                  ]}
                >
                  <View style={styles.legRowLeft}>
                    {/* Status Icons per Section 4.5 */}
                    <View style={styles.statusIndicator}>
                      {isPending && <View style={styles.dotPending} />}
                      {isInProgress && <View style={styles.dotInProgress} />}
                      {isSuccess && <Text style={styles.iconSuccess}>✓</Text>}
                      {isFailed && <Text style={styles.iconFailed}>✕</Text>}
                      {isUnknown && <Text style={styles.iconUnknown}>?</Text>}
                    </View>

                    <View style={styles.legDetails}>
                      <View style={styles.legTitleRow}>
                        <Text style={styles.legTitle}>Payment #{leg.index + 1}</Text>
                        {isSuccess && (
                          <View style={styles.pillSuccess}>
                            <Text style={styles.pillSuccessText}>Paid</Text>
                          </View>
                        )}
                        {isFailed && (
                          <View style={styles.pillFailed}>
                            <Text style={styles.pillFailedText}>Failed</Text>
                          </View>
                        )}
                        {isUnknown && (
                          <View style={styles.pillUnknown}>
                            <Text style={styles.pillUnknownText}>Awaiting Check</Text>
                          </View>
                        )}
                      </View>

                      {/* Small monospace UPI txnId & approval reference per Section 4.5 */}
                      {isSuccess && leg.txnId && (
                        <Text style={styles.refText}>
                          Ref: {leg.txnId} {leg.approvalRef ? `• ${leg.approvalRef}` : ''}
                        </Text>
                      )}

                      {/* Unknown / Submitted affordance: Yes / No buttons per Section 4.5 & 9.26 */}
                      {isUnknown && (
                        <View style={styles.unknownBox}>
                          <Text style={styles.unknownPrompt}>
                            Did this payment go through in your bank app?
                          </Text>
                          <View style={styles.unknownActions}>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => resolveUnknownLeg(leg.index, true)}
                              style={styles.unknownBtnYes}
                            >
                              <Text style={styles.unknownBtnText}>Yes, paid</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => resolveUnknownLeg(leg.index, false)}
                              style={styles.unknownBtnNo}
                            >
                              <Text style={styles.unknownBtnText}>No, failed</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.legRowRight}>
                    <Text style={styles.legAmount}>
                      ₹{legFormatted.rupeePart}.{legFormatted.decimalPart}
                    </Text>
                    {isFailed && (
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={handlePressPay}
                        style={styles.retryButton}
                      >
                        <Text style={styles.retryText}>Retry</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </GlassCard>
              );
            })}
          </View>
        </ScrollView>

        {/* Primary Action & Secondary Actions Footer */}
        <View style={styles.footer}>
          {nextPendingLeg ? (
            <GradientButton
              label={`Pay ₹${(nextPendingLeg.amountPaise / 100).toFixed(2)}`}
              onPress={handlePressPay}
              loading={session.inFlight}
              cooldownSeconds={cooldownRemaining}
            />
          ) : (
            <GradientButton
              label="View Final Receipt"
              onPress={() => navigation.navigate('Success', { partial: doneCount < totalCount })}
            />
          )}

          {/* Secondary Actions: Pause and Abandon per Section 4.5 */}
          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handlePause}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleAbandon}
              style={styles.secondaryBtn}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.danger }]}>
                Abandon
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* UPI App Selection Bottom Sheet per Section 4.5 & 7.2 */}
      <Modal visible={appsSheetVisible} transparent animationType="slide">
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity
            style={styles.sheetDismissArea}
            activeOpacity={1}
            onPress={() => setAppsSheetVisible(false)}
          />
          <GlassCard elevated style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Choose UPI App</Text>
              <Text style={styles.sheetSubtitle}>
                Authorizing leg for ₹{nextPendingLeg ? (nextPendingLeg.amountPaise / 100).toFixed(2) : '0.00'}
              </Text>
            </View>

            <ScrollView style={styles.sheetAppList}>
              {sortedApps.length === 0 ? (
                <View style={styles.emptyAppsContainer}>
                  <Text style={styles.emptyAppsTitle}>No UPI app found on this device</Text>
                  <Text style={styles.emptyAppsSub}>
                    Install a supported UPI app (PhonePe, Google Pay, BHIM, etc.) to complete payment.
                  </Text>
                </View>
              ) : (
                sortedApps.map((app) => {
                  const isPinned = app.packageName === session.lastUsedPackage;
                  return (
                    <TouchableOpacity
                      key={app.packageName}
                      activeOpacity={0.75}
                      onPress={() => executePaymentLeg(app)}
                      style={[styles.appItem, isPinned && styles.appItemPinned]}
                    >
                      <View style={styles.appItemLeft}>
                        <View
                          style={[
                            styles.appIconContainer,
                            app.brandColor ? { backgroundColor: app.brandColor } : undefined,
                          ]}
                        >
                          <Text style={styles.appInitial}>
                            {app.label.charAt(0)}
                          </Text>
                        </View>
                        <View>
                          <Text style={styles.appLabel}>{app.label}</Text>
                          {isPinned ? (
                            <Text style={styles.pinnedLabel}>Last used • Instant handoff</Text>
                          ) : (
                            <Text style={styles.appPkgMuted}>{app.packageName}</Text>
                          )}
                        </View>
                      </View>
                      <Text style={styles.appArrow}>→</Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setAppsSheetVisible(false)}
              style={styles.sheetCancelBtn}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.glassFill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.title,
    fontSize: 16,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  mockToggle: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  mockToggleActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.2)',
    borderColor: colors.accentEnd,
  },
  mockToggleText: {
    ...typography.pillLabel,
    color: colors.accentEnd,
    fontSize: 10,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  payeeCard: {
    padding: spacing.md,
  },
  payeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  merchantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantAvatarText: {
    fontSize: 20,
  },
  payeeInfo: {
    flex: 1,
  },
  payeeName: {
    ...typography.title,
    fontSize: 15,
  },
  payeeVpa: {
    ...typography.captionMedium,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  badgeActive: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    borderWidth: 1,
    borderColor: colors.accentEnd,
  },
  badgeActiveText: {
    ...typography.pillLabel,
    color: colors.accentEnd,
  },
  progressCard: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  progressMainText: {
    ...typography.title,
    fontSize: 18,
    color: colors.textPrimary,
  },
  progressSubText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textMuted,
  },
  percentText: {
    ...typography.captionMedium,
    color: colors.accentEnd,
    fontWeight: '700',
  },
  progressBar: {
    marginVertical: spacing.xs,
  },
  progressFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  remainingText: {
    ...typography.captionMedium,
    color: colors.textMuted,
  },
  countText: {
    ...typography.captionMedium,
    color: colors.textFaint,
  },
  legListContainer: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  legListHeader: {
    ...typography.captionMedium,
    color: colors.textFaint,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.row,
  },
  legRowSuccess: {
    borderColor: 'rgba(43, 217, 160, 0.25)',
  },
  legRowFailed: {
    borderColor: 'rgba(255, 84, 112, 0.3)',
  },
  legRowUnknown: {
    borderColor: 'rgba(255, 176, 32, 0.3)',
  },
  legRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  statusIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPending: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textFaint,
  },
  dotInProgress: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accentEnd,
  },
  iconSuccess: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '700',
  },
  iconFailed: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  iconUnknown: {
    color: colors.pending,
    fontSize: 16,
    fontWeight: '700',
  },
  legDetails: {
    flex: 1,
  },
  legTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legTitle: {
    ...typography.title,
    fontSize: 14,
  },
  pillSuccess: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(43, 217, 160, 0.15)',
  },
  pillSuccessText: {
    ...typography.pillLabel,
    color: colors.success,
    fontSize: 10,
  },
  pillFailed: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 84, 112, 0.15)',
  },
  pillFailedText: {
    ...typography.pillLabel,
    color: colors.danger,
    fontSize: 10,
  },
  pillUnknown: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 176, 32, 0.15)',
  },
  pillUnknownText: {
    ...typography.pillLabel,
    color: colors.pending,
    fontSize: 10,
  },
  refText: {
    ...typography.caption,
    fontFamily: 'monospace',
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  unknownBox: {
    marginTop: spacing.xs,
    padding: spacing.xs,
    backgroundColor: 'rgba(255, 176, 32, 0.08)',
    borderRadius: radii.sm,
  },
  unknownPrompt: {
    ...typography.caption,
    color: colors.pending,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  unknownActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  unknownBtnYes: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  unknownBtnNo: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  unknownBtnText: {
    ...typography.pillLabel,
    color: '#07070B',
    fontWeight: '700',
  },
  legRowRight: {
    alignItems: 'flex-end',
  },
  legAmount: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.dangerFill,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  retryText: {
    ...typography.pillLabel,
    color: colors.danger,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  secondaryBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  secondaryBtnText: {
    ...typography.captionMedium,
    color: colors.textMuted,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheetContent: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: spacing.lg,
    maxHeight: '65%',
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: spacing.sm,
  },
  sheetTitle: {
    ...typography.title,
    fontSize: 17,
  },
  sheetSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  sheetAppList: {
    marginVertical: spacing.xs,
  },
  emptyAppsContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyAppsTitle: {
    ...typography.title,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyAppsSub: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  appItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  appItemPinned: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radii.row,
  },
  appItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  appIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.accentStart,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appInitial: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  appLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  pinnedLabel: {
    ...typography.caption,
    color: colors.accentEnd,
    fontSize: 11,
  },
  appPkgMuted: {
    ...typography.caption,
    color: colors.textFaint,
    fontSize: 10,
  },
  appArrow: {
    color: colors.textMuted,
    fontSize: 18,
  },
  sheetCancelBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  sheetCancelText: {
    ...typography.captionMedium,
    color: colors.textMuted,
  },
});
