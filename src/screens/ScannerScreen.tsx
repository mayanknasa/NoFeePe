import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  TextInput,
  Image,
  Platform,
  ScrollView,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { realUpiIntent } from '../native/upiIntent';
import {
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import { ScannerCamera } from '../components/ScannerCamera';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { RootStackParamList } from '../types';
import { parseUpiUri, UpiParseError, VPA_REGEX } from '../domain/upi';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { GlassCard } from '../components/GlassCard';
import { CustomModal } from '../components/CustomModal';
import { UpdateModal } from '../components/UpdateModal';
import { AppIcon } from '../components/AppIcon';
import { checkForAppUpdate, UpdateInfo } from '../services/updateChecker';

const CUTOUT_SIZE = 260;
const POPULAR_HANDLES = ['@okaxis', '@okhdfcbank', '@paytm', '@ybl', '@upi', '@sbi'] as const;

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

/**
 * Main Scanner & Homepage Screen.
 * Implements Section 4.2 of AGENTS.md:
 * - Live camera viewfinder with rounded corners matching the target frame.
 * - Dynamic 2s animated laser sweep line.
 * - Torch / Flashlight toggle button with instant hardware illumination.
 * - About navigation route.
 * - Haptic feedback and error shakes on invalid QR scans.
 * - Pick QR from gallery option via Google ML Kit.
 * - Direct manual UPI ID entry with keyboard-adaptive auto-scroll.
 * - GitHub release update checker popup.
 * - Custom app-themed permission modals.
 */
export const ScannerScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  const [torch, setTorch] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [showRationale, setShowRationale] = useState(false);
  const [permissionPermanentlyDenied, setPermissionPermanentlyDenied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [manualUpi, setManualUpi] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isScanningActive, setIsScanningActive] = useState(true);

  const trimmedUpi = manualUpi.trim();
  const isValidUpi = useMemo(() => VPA_REGEX.test(trimmedUpi), [trimmedUpi]);

  const [availableUpdate, setAvailableUpdate] = useState<UpdateInfo | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);

  const handleSelectSuggestion = useCallback((handle: string) => {
    triggerHaptic('impactLight');
    setValidationError(null);
    setManualUpi((prev) => {
      const current = prev.trim();
      let next = '';
      if (current.includes('@')) {
        const prefix = current.split('@')[0];
        next = prefix + handle;
      } else {
        next = current + handle;
      }
      return next;
    });
    // Refocus input smoothly so keyboard remains open and user can proceed or edit
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, []);

  const handleExitManualMode = useCallback(() => {
    triggerHaptic('impactLight');
    Keyboard.dismiss();
    setIsManualMode(false);
  }, []);

  // Turn off torch when leaving screen to preserve battery & camera sensor health
  useEffect(() => {
    if (!isFocused) {
      setTorch(false);
    }
  }, [isFocused]);

  // Track keyboard visibility
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        setIsManualMode(true);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Check GitHub releases for updates on startup
  useEffect(() => {
    try {
      checkForAppUpdate().then((update) => {
        if (update?.isAvailable) {
          setAvailableUpdate(update);
          setShowUpdateModal(true);
        }
      }).catch((err: unknown) => {
        console.debug?.('[ScannerScreen] Update check caught safely:', err);
      });
    } catch (err: unknown) {
      console.warn('[ScannerScreen] Error initiating update check:', err);
    }
  }, []);

  // Animation values
  const sweepLine = useSharedValue(0);
  const shakeOffset = useSharedValue(0);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      if (isFocused && isScanningActive) {
        // 2s vertical sweep looping per Section 4.2
        sweepLine.value = withRepeat(
          withTiming(CUTOUT_SIZE, {
            duration: 2000,
            easing: Easing.linear,
          }),
          -1,
          true
        );
      } else {
        cancelAnimation(sweepLine);
      }
    } catch (err: unknown) {
      console.warn('[ScannerScreen] Sweep animation error:', err);
    }

    return () => {
      try {
        cancelAnimation(sweepLine);
      } catch {}
    };
  }, [isFocused, isScanningActive, sweepLine]);

  useEffect(() => {
    if (!hasPermission) {
      setShowRationale(true);
    }
  }, [hasPermission]);

  const showToast = useCallback((msg: string) => {
    try {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToastMessage(msg);
      toastTimerRef.current = setTimeout(() => {
        setToastMessage(null);
      }, 2800);
    } catch (err: unknown) {
      console.warn('[ScannerScreen] showToast error:', err);
    }
  }, []);

  const triggerHaptic = (
    type: 'impactMedium' | 'impactLight' | 'notificationError' | 'notificationSuccess'
  ) => {
    try {
      ReactNativeHapticFeedback.trigger(type, {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    } catch (err: unknown) {
      console.debug?.('[ScannerScreen] Haptic feedback error:', err);
    }
  };

  const handleToggleTorch = () => {
    if (device && !device.hasTorch) {
      showToast('Flashlight not supported on this device');
      return;
    }
    setTorch((prev) => !prev);
    triggerHaptic('impactLight');
  };

  const handleScanSuccess = useCallback(
    (scannedString: string) => {
      if (!isScanningActive) return;

      try {
        const parsed = parseUpiUri(scannedString);
        setIsScanningActive(false);
        triggerHaptic('notificationSuccess');

        navigation?.navigate?.('Amount', {
          payeeVpa: parsed?.payeeVpa,
          payeeName: parsed?.payeeName,
          fixedAmountPaise: parsed?.fixedAmountPaise,
          merchantCode: parsed?.merchantCode,
          signature: parsed?.signature,
          transactionNote: parsed?.transactionNote,
        });
      } catch (err: unknown) {
        triggerHaptic('notificationError');

        try {
          // Shake animation on error
          shakeOffset.value = withSequence(
            withTiming(-12, { duration: 60 }),
            withTiming(12, { duration: 60 }),
            withTiming(-8, { duration: 60 }),
            withTiming(8, { duration: 60 }),
            withTiming(0, { duration: 60 })
          );
        } catch {
          // Ignore animation error
        }

        if (err instanceof UpiParseError) {
          showToast(err.message);
        } else {
          showToast('Not a UPI QR code');
        }
      }
    },
    [isScanningActive, navigation, shakeOffset, showToast]
  );

  // Re-enable scanning when screen regains focus
  useEffect(() => {
    if (isFocused) {
      setIsScanningActive(true);
    }
  }, [isFocused]);

  const handleRequestCamera = async () => {
    try {
      setShowRationale(false);
      const granted = await requestPermission();
      if (!granted) {
        setPermissionPermanentlyDenied(true);
      }
    } catch (err: unknown) {
      console.warn('[ScannerScreen] handleRequestCamera error:', err);
      setPermissionPermanentlyDenied(true);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
      });

      if (result?.assets?.[0]?.uri) {
        showToast('Scanning QR from chosen image...');
        try {
          const scanned = await realUpiIntent?.scanQr?.(result.assets[0].uri);
          if (scanned && scanned.trim().length > 0) {
            handleScanSuccess(scanned.trim());
          } else {
            showToast('No QR code found in that image.');
          }
        } catch (scanErr: unknown) {
          console.warn('[ScannerScreen] scanQr failed:', scanErr);
          showToast('No QR code found in that image.');
        }
      }
    } catch (galleryErr: unknown) {
      console.warn('[ScannerScreen] launchImageLibrary error:', galleryErr);
      showToast('Could not open image gallery.');
    }
  };

  const handleManualProceed = useCallback(() => {
    try {
      const trimmed = manualUpi?.trim() ?? '';
      if (!trimmed) {
        triggerHaptic('notificationError');
        setValidationError('Please enter a UPI ID');
        return;
      }

      if (!VPA_REGEX.test(trimmed)) {
        triggerHaptic('notificationError');
        setValidationError('Invalid UPI ID. Format must be handle@bank (e.g. merchant@upi)');
        return;
      }

      setValidationError(null);
      Keyboard.dismiss();
      setIsManualMode(false);
      setIsScanningActive(false);
      triggerHaptic('notificationSuccess');

      navigation?.navigate?.('Amount', {
        payeeVpa: trimmed,
        payeeName: null,
        fixedAmountPaise: null,
      });
    } catch (err: unknown) {
      console.warn('[ScannerScreen] handleManualProceed error:', err);
      triggerHaptic('notificationError');
      setValidationError('Invalid UPI ID. Please check and re-enter.');
    }
  }, [manualUpi, navigation]);

  const animatedCutoutStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value ?? 0 }],
  }));

  const animatedSweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sweepLine.value ?? 0 }],
  }));

  const containerInsetsStyle = useMemo(
    () => ({
      paddingTop: insets.top + spacing.sm,
      paddingBottom: (isKeyboardVisible || isManualMode) ? 0 : Math.max(insets.bottom, 16) + spacing.xs,
    }),
    [insets.top, insets.bottom, isKeyboardVisible, isManualMode]
  );

  return (
    <View style={[styles.container, containerInsetsStyle]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleBadge}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>NoFeePe</Text>
        </View>

        <View style={styles.headerActions}>
          {/* Torch / Flashlight Toggle Button */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={handleToggleTorch}
            style={[
              styles.iconButton,
              torch && styles.iconButtonActiveTorch,
            ]}
            accessibilityLabel={torch ? 'Turn off flashlight' : 'Turn on flashlight'}
          >
            <View style={styles.torchIconContainer}>
              {torch && (
                <View style={styles.torchRaysContainer}>
                  <View style={[styles.torchRay, styles.torchRayLeft]} />
                  <View style={[styles.torchRay, styles.torchRayCenter]} />
                  <View style={[styles.torchRay, styles.torchRayRight]} />
                </View>
              )}
              <View style={styles.torchBodyLayout}>
                <View style={[styles.torchHead, torch && styles.torchElementActive]} />
                <View style={[styles.torchNeck, torch && styles.torchElementActive]} />
                <View style={[styles.torchHandle, torch && styles.torchElementActive]}>
                  <View style={[styles.torchSwitch, torch && styles.torchSwitchActive]} />
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* About Application Button */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => {
              triggerHaptic('impactLight');
              navigation?.navigate?.('About');
            }}
            style={styles.iconButton}
            accessibilityLabel="About NoFeePe"
          >
            <View style={styles.aboutIconBadge}>
              <Text style={styles.aboutIconText}>i</Text>
            </View>
          </TouchableOpacity>

          {/* Transaction History Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              try {
                navigation?.navigate?.('History');
              } catch (err: unknown) {
                console.warn('[ScannerScreen] Navigate to History error:', err);
              }
            }}
            style={styles.iconButton}
            accessibilityLabel="Transaction History"
          >
            <View style={styles.historyIconPill}>
              <View style={[styles.historyBar, styles.historyBarWide]} />
              <View style={[styles.historyBar, styles.historyBarNarrow]} />
              <View style={[styles.historyBar, styles.historyBarWide]} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content Area: KeyboardAvoidingView wrapping centered ScrollView */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollContainer}
          contentContainerStyle={(isKeyboardVisible || isManualMode) ? styles.scrollContentKeyboard : styles.scrollContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {(isKeyboardVisible || isManualMode) ? (
            /* Dedicated Focused Mode when typing UPI ID */
            <View style={styles.keyboardActiveWrapper}>
              {/* Back to QR Scanner pill */}
              <View style={styles.keyboardTopRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleExitManualMode}
                  style={styles.backToScanButton}
                  accessibilityLabel="Back to QR scanner"
                >
                  <AppIcon name="chevronRight" size={13} color="#C4B5FD" style={styles.chevronBack} />
                  <Text style={styles.backToScanButtonText}>Scan QR Code instead</Text>
                </TouchableOpacity>

                <View style={styles.instantBadge}>
                  <Text style={styles.instantBadgeText}>MANUAL</Text>
                </View>
              </View>

              {/* Focused Manual Entry Card */}
              <GlassCard style={styles.manualCardKeyboard}>
                <Text style={styles.keyboardCardTitle}>Enter Payee UPI ID</Text>
                <Text style={styles.keyboardCardSub}>
                  Enter the virtual payment address of any bank or UPI app
                </Text>

                <View
                  style={[
                    styles.inputRowKeyboard,
                    validationError ? styles.inputRowError : (isValidUpi ? styles.inputRowSuccess : null),
                  ]}
                >
                  <View style={styles.atSymbolBox}>
                    <Text style={styles.atSymbol}>@</Text>
                  </View>
                  <TextInput
                    ref={inputRef}
                    style={styles.manualInputKeyboard}
                    placeholder="e.g. merchant@upi or 9876543210@paytm"
                    placeholderTextColor={colors?.textFaint ?? '#5A5F73'}
                    value={manualUpi}
                    onChangeText={(text) => {
                      setManualUpi(text);
                      if (validationError) setValidationError(null);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="go"
                    onSubmitEditing={handleManualProceed}
                    autoFocus={true}
                  />
                  {manualUpi.length > 0 && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => {
                        setManualUpi('');
                        setValidationError(null);
                      }}
                      style={styles.clearInputButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.clearInputText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Real-time Validation Message */}
                <View style={styles.statusMessageRow}>
                  {validationError ? (
                    <View style={styles.statusContentRow}>
                      <AppIcon name="warning" size={12} color="#FF5470" />
                      <Text style={styles.validationErrorText}>{validationError}</Text>
                    </View>
                  ) : isValidUpi ? (
                    <View style={styles.statusContentRow}>
                      <AppIcon name="check" size={12} color="#2BD9A0" />
                      <Text style={styles.validationSuccessText}>Valid UPI ID format</Text>
                    </View>
                  ) : manualUpi.trim().length > 0 ? (
                    <View style={styles.statusContentRow}>
                      <AppIcon name="info" size={12} color="#9AA0B4" />
                      <Text style={styles.validationHintText}>Add bank handle (e.g. @paytm or @upi)</Text>
                    </View>
                  ) : (
                    <View style={styles.statusContentRow}>
                      <AppIcon name="shield" size={12} color="#C4B5FD" />
                      <Text style={styles.validationHintText}>Zero MDR on all UPI payments</Text>
                    </View>
                  )}
                </View>

                {/* Popular Handle Suggestions */}
                {manualUpi.trim().length > 0 && !manualUpi.includes('@') && (
                  <View style={styles.handleSuggestionsWrapper}>
                    <Text style={styles.handleSuggestionsLabel}>Suggested Handles:</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="always"
                      contentContainerStyle={styles.handleChipsScroll}
                    >
                      {POPULAR_HANDLES.map((handle) => (
                        <TouchableOpacity
                          key={handle}
                          activeOpacity={0.7}
                          onPress={() => handleSelectSuggestion(handle)}
                          style={styles.handleChip}
                        >
                          <Text style={styles.handleChipText}>{handle}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Full-width Theme Purple Proceed Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleManualProceed}
                  style={[
                    styles.proceedFullButton,
                    !isValidUpi && styles.proceedButtonDisabled,
                  ]}
                  disabled={!isValidUpi}
                  accessibilityLabel="Proceed with UPI ID"
                >
                  <Text
                    style={[
                      styles.proceedFullText,
                      !isValidUpi && styles.proceedTextDisabled,
                    ]}
                  >
                    Proceed to Pay
                  </Text>
                </TouchableOpacity>
              </GlassCard>
            </View>
          ) : (
            /* Normal Mode: Camera Scanner + Gallery + Bottom Input */
            <>
              {/* Center Scanner Frame */}
              <View style={styles.scannerWrapper}>
                <Animated.View
                  style={[
                    styles.cutoutFrame,
                    animatedCutoutStyle,
                  ]}
                >
                  {device && hasPermission && isFocused && (
                    <ScannerCamera
                      device={device}
                      isActive={isFocused && isScanningActive}
                      torch={torch}
                      onScanSuccess={handleScanSuccess}
                    />
                  )}

                  {/* Neon Frame Corners */}
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />

                  {/* Laser Sweep Line */}
                  {isScanningActive && (
                    <Animated.View style={[styles.sweepLine, animatedSweepStyle]}>
                      <LinearGradient
                        colors={['transparent', colors?.accentEnd ?? '#00D9F5', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.sweepGradient}
                      />
                    </Animated.View>
                  )}

                  {/* Floating Error Toast */}
                  {toastMessage && (
                    <View style={styles.floatingToast}>
                      <View style={styles.toastContentRow}>
                        <AppIcon name="warning" size={13} color="#FFFFFF" />
                        <Text style={styles.floatingToastText}>{toastMessage}</Text>
                      </View>
                    </View>
                  )}
                </Animated.View>

                <Text style={styles.scannerPrompt}>Point camera at any UPI QR code</Text>
                <Text style={styles.scannerSubPrompt}>Zero MDR • Works with all bank QR codes</Text>
              </View>

              {/* Bottom Actions Cluster */}
              <View style={styles.bottomCluster}>
                {/* Upload QR Card */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={handlePickFromGallery}
                  style={styles.galleryCardTouchable}
                >
                  <GlassCard elevated style={styles.galleryCard}>
                    <View style={styles.galleryIconWrapper}>
                      <AppIcon name="gallery" size={22} color={colors?.accentEnd ?? '#22D3EE'} />
                    </View>
                    <View style={styles.galleryTextContainer}>
                      <Text style={styles.galleryCardTitle}>Upload QR from Gallery</Text>
                      <Text style={styles.galleryCardSub}>Scan photos, screenshots, or invoices</Text>
                    </View>
                    <View style={styles.galleryChevronContainer}>
                      <View style={styles.galleryChevron} />
                    </View>
                  </GlassCard>
                </TouchableOpacity>

                {/* Manual UPI ID Input Card */}
                <GlassCard style={styles.manualCard}>
                  <View style={styles.manualHeaderRow}>
                    <Text style={styles.manualLabel}>ENTER UPI ID</Text>
                    <View style={styles.instantBadge}>
                      <Text style={styles.instantBadgeText}>INSTANT</Text>
                    </View>
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.atSymbolBox}>
                      <Text style={styles.atSymbol}>@</Text>
                    </View>
                    <View style={styles.inputFieldContainer}>
                      <TextInput
                        style={styles.manualInput}
                        placeholder="e.g. merchant@upi"
                        placeholderTextColor={colors?.textFaint ?? '#5A5F73'}
                        value={manualUpi}
                        onFocus={() => {
                          setIsManualMode(true);
                        }}
                        onChangeText={(text) => {
                          setManualUpi(text);
                          if (validationError) setValidationError(null);
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="email-address"
                        returnKeyType="go"
                        onSubmitEditing={handleManualProceed}
                      />
                      {manualUpi.length > 0 && (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            setManualUpi('');
                            setValidationError(null);
                          }}
                          style={styles.clearInputButton}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={styles.clearInputText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleManualProceed}
                      style={[
                        styles.proceedButton,
                        !isValidUpi && styles.proceedButtonDisabled,
                      ]}
                      disabled={!isValidUpi}
                    >
                      <View style={styles.proceedButtonContent}>
                        <Text
                          style={[
                            styles.proceedText,
                            !isValidUpi && styles.proceedTextDisabled,
                          ]}
                        >
                          Proceed
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                  {validationError && (
                    <View style={styles.inlineErrorRow}>
                      <AppIcon name="warning" size={12} color="#FF5470" />
                      <Text style={styles.inlineErrorText}>{validationError}</Text>
                    </View>
                  )}
                </GlassCard>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* GitHub Update Modal */}
      <UpdateModal
        update={availableUpdate}
        visible={showUpdateModal}
        onDismiss={() => setShowUpdateModal(false)}
      />

      {/* Camera Permission Rationale Modal */}
      <CustomModal
        visible={showRationale}
        iconType="info"
        title="Camera Access Required"
        message="NoFeePe needs your camera to scan UPI QR codes directly from merchants, bills, and payment terminals."
        primaryButton={{
          text: 'Grant Permission',
          onPress: handleRequestCamera,
        }}
        secondaryButton={{
          text: 'Not Now',
          onPress: () => setShowRationale(false),
        }}
        onDismiss={() => setShowRationale(false)}
      />

      {/* Camera Permanently Denied Modal */}
      <CustomModal
        visible={permissionPermanentlyDenied}
        iconType="warning"
        title="Camera Permission Denied"
        message="Camera permission is permanently denied. Please enable camera access in your device settings to scan QR codes."
        primaryButton={{
          text: 'Open Settings',
          onPress: () => {
            setPermissionPermanentlyDenied(false);
            try {
              Linking.openSettings();
            } catch (err: unknown) {
              console.warn('[ScannerScreen] Linking.openSettings error:', err);
            }
          },
        }}
        secondaryButton={{
          text: 'Cancel',
          onPress: () => setPermissionPermanentlyDenied(false),
        }}
        onDismiss={() => setPermissionPermanentlyDenied(false)}
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
  headerTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii?.pill ?? 9999,
  },
  headerLogo: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  headerTitle: {
    ...typography.headingSm,
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActiveTorch: {
    backgroundColor: 'rgba(255, 215, 0, 0.18)',
    borderColor: 'rgba(255, 215, 0, 0.6)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  torchIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
  },
  torchRaysContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: 20,
    height: 5,
    marginBottom: 1,
  },
  torchRay: {
    width: 1.5,
    height: 4,
    backgroundColor: '#FFD700',
    borderRadius: 0.75,
  },
  torchRayLeft: {
    transform: [{ rotate: '-25deg' }],
    marginRight: 3,
  },
  torchRayCenter: {
    height: 5,
  },
  torchRayRight: {
    transform: [{ rotate: '25deg' }],
    marginLeft: 3,
  },
  torchBodyLayout: {
    alignItems: 'center',
  },
  torchHead: {
    width: 13,
    height: 3.5,
    backgroundColor: '#8E92A8',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  torchNeck: {
    width: 9,
    height: 1.5,
    backgroundColor: '#71758A',
  },
  torchHandle: {
    width: 8,
    height: 8.5,
    backgroundColor: '#8E92A8',
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  torchSwitch: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: '#1E2030',
  },
  torchElementActive: {
    backgroundColor: '#FFD700',
  },
  torchSwitchActive: {
    backgroundColor: '#FFFFFF',
  },
  aboutIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.8,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutIconText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'android' ? 'sans-serif-medium' : 'System',
    marginTop: -1,
  },
  historyIconPill: {
    alignItems: 'center',
    gap: 3,
  },
  historyBar: {
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  historyBarWide: {
    width: 14,
  },
  historyBarNarrow: {
    width: 10,
  },
  keyboardAvoidingView: {
    flex: 1,
    width: '100%',
  },
  scrollContainer: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.lg,
  },
  scrollContentKeyboard: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    width: '100%',
  },
  scannerWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  cutoutFrame: {
    width: CUTOUT_SIZE,
    height: CUTOUT_SIZE,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(124, 92, 255, 0.25)',
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: colors?.accentEnd ?? '#00D9F5',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: colors?.accentEnd ?? '#00D9F5',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 24,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 24,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 24,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 24,
  },
  sweepLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2.5,
  },
  sweepGradient: {
    width: '100%',
    height: '100%',
  },
  floatingToast: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    borderRadius: radii?.pill ?? 9999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    elevation: 8,
    zIndex: 99,
  },
  toastContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  floatingToastText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  scannerPrompt: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  scannerSubPrompt: {
    ...typography.caption,
    color: colors?.textPurpleLight ?? '#C4B5FD',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  bottomCluster: {
    width: '100%',
    gap: spacing.sm + 2,
  },
  galleryCardTouchable: {
    width: '100%',
  },
  galleryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: '#13141F',
    borderWidth: 1,
    borderColor: '#2A2B3D',
    borderRadius: 18,
  },
  galleryIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(124, 92, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  galleryIconEmoji: {
    fontSize: 22,
  },
  galleryTextContainer: {
    flex: 1,
  },
  galleryCardTitle: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  galleryCardSub: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 12,
    marginTop: 2,
  },
  galleryChevronContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryChevron: {
    width: 8,
    height: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: colors?.accentEnd ?? '#00D9F5',
    transform: [{ rotate: '45deg' }],
    marginLeft: -2,
  },
  manualCard: {
    padding: spacing.md,
    backgroundColor: '#13141F',
    borderWidth: 1,
    borderColor: '#2A2B3D',
    borderRadius: 18,
  },
  manualCardActive: {
    borderColor: colors?.accentEnd ?? '#00D9F5',
    borderWidth: 1.2,
  },
  manualHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  manualLabel: {
    ...typography.captionMedium,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  instantBadge: {
    backgroundColor: 'rgba(0, 245, 160, 0.12)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.3)',
  },
  instantBadgeText: {
    ...typography.caption,
    fontSize: 10,
    color: colors?.accentStart ?? '#00F5A0',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  atSymbolBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  atSymbol: {
    fontSize: 18,
    color: colors?.accentEnd ?? '#00D9F5',
    fontWeight: '700',
  },
  inputFieldContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  manualInput: {
    width: '100%',
    height: 44,
    backgroundColor: '#0B0C14',
    borderWidth: 1,
    borderColor: '#2A2B3D',
    borderRadius: 12,
    paddingLeft: spacing.md,
    paddingRight: 34,
    color: '#FFFFFF',
    fontSize: 14,
  },
  clearInputButton: {
    position: 'absolute',
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearInputText: {
    color: '#CBD0E2',
    fontSize: 10,
    fontWeight: '700',
  },
  proceedButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primaryButton ?? '#6338F2',
    borderWidth: 1,
    borderColor: colors.primaryButtonBorder ?? '#7C5CFF',
    overflow: 'hidden',
  },
  proceedButtonDisabled: {
    backgroundColor: colors.primaryButtonDisabled ?? '#1C1635',
    borderColor: colors.primaryButtonDisabledBorder ?? '#2E2452',
  },
  proceedButtonContent: {
    height: '100%',
    paddingHorizontal: spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proceedText: {
    ...typography.bodyMedium,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  proceedTextDisabled: {
    color: colors.primaryButtonTextDisabled ?? '#5E5380',
  },
  keyboardActiveWrapper: {
    width: '100%',
    gap: spacing.sm,
  },
  keyboardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  backToScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii?.pill ?? 9999,
    backgroundColor: 'rgba(124, 92, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 255, 0.3)',
  },
  chevronBack: {
    transform: [{ rotate: '180deg' }],
  },
  backToScanButtonText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '700',
  },
  manualCardKeyboard: {
    padding: spacing.md,
    backgroundColor: '#13141F',
    borderWidth: 1,
    borderColor: '#2A2B3D',
    borderRadius: 18,
    gap: spacing.sm,
  },
  keyboardCardTitle: {
    ...typography.headingSm,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  keyboardCardSub: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 12,
    marginTop: -2,
  },
  inputRowKeyboard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#0B0C14',
    borderWidth: 1,
    borderColor: '#2A2B3D',
    borderRadius: 12,
    paddingHorizontal: 6,
  },
  inputRowError: {
    borderColor: '#FF5470',
  },
  inputRowSuccess: {
    borderColor: '#2BD9A0',
  },
  manualInputKeyboard: {
    flex: 1,
    height: 44,
    color: '#FFFFFF',
    fontSize: 14,
    paddingHorizontal: spacing.sm,
  },
  statusMessageRow: {
    minHeight: 18,
  },
  statusContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  validationErrorText: {
    ...typography.caption,
    color: '#FF5470',
    fontSize: 12,
    fontWeight: '600',
  },
  validationSuccessText: {
    ...typography.caption,
    color: '#2BD9A0',
    fontSize: 12,
    fontWeight: '600',
  },
  validationHintText: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 12,
  },
  handleSuggestionsWrapper: {
    gap: 6,
    marginTop: 2,
  },
  handleSuggestionsLabel: {
    ...typography.caption,
    color: colors?.textFaint ?? '#5A5F73',
    fontSize: 11,
    fontWeight: '600',
  },
  handleChipsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  handleChip: {
    backgroundColor: 'rgba(124, 92, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 255, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  handleChipText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '600',
  },
  proceedFullButton: {
    backgroundColor: colors.primaryButton ?? '#6338F2',
    borderWidth: 1,
    borderColor: colors.primaryButtonBorder ?? '#7C5CFF',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  proceedFullText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  inlineErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  inlineErrorText: {
    ...typography.caption,
    color: '#FF5470',
    fontSize: 11.5,
    fontWeight: '600',
  },
});
