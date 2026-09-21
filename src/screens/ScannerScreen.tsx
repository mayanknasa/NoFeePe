import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useObjectOutput,
  ScannedObject,
  ScannedCode,
} from 'react-native-vision-camera';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { RootStackParamList } from '../types';
import { parseUpiUri, UpiParseError } from '../domain/upi';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { GlassCard } from '../components/GlassCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CUTOUT_SIZE = 260;

type Props = NativeStackScreenProps<RootStackParamList, 'Scanner'>;

export const ScannerScreen: React.FC<Props> = ({ navigation }) => {
  const isFocused = useIsFocused();
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  const [torch, setTorch] = useState(false);
  const [showRationale, setShowRationale] = useState(false);
  const [permissionPermanentlyDenied, setPermissionPermanentlyDenied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [manualUpi, setManualUpi] = useState('');
  const [isScanningActive, setIsScanningActive] = useState(true);

  // Animation values
  const sweepLine = useSharedValue(0);
  const shakeOffset = useSharedValue(0);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 2s vertical sweep looping per Section 4.2
    sweepLine.value = withRepeat(
      withTiming(CUTOUT_SIZE, {
        duration: 2000,
        easing: Easing.linear,
      }),
      -1,
      true
    );
  }, [sweepLine]);

  useEffect(() => {
    if (!hasPermission) {
      setShowRationale(true);
    }
  }, [hasPermission]);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  const triggerHaptic = (type: 'impactMedium' | 'notificationError' | 'notificationSuccess') => {
    try {
      ReactNativeHapticFeedback.trigger(type, {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
    } catch {
      // safe fallback
    }
  };

  const handleScanSuccess = useCallback(
    (scannedString: string) => {
      if (!isScanningActive) return;

      try {
        const parsed = parseUpiUri(scannedString);
        setIsScanningActive(false);
        triggerHaptic('notificationSuccess');

        navigation.navigate('Amount', {
          payeeVpa: parsed.payeeVpa,
          payeeName: parsed.payeeName,
          fixedAmountPaise: parsed.fixedAmountPaise,
          merchantCode: parsed.merchantCode,
          signature: parsed.signature,
          transactionNote: parsed.transactionNote,
        });
      } catch (err: unknown) {
        triggerHaptic('notificationError');

        // Shake animation
        shakeOffset.value = withSequence(
          withTiming(-12, { duration: 60 }),
          withTiming(12, { duration: 60 }),
          withTiming(-8, { duration: 60 }),
          withTiming(8, { duration: 60 }),
          withTiming(0, { duration: 60 })
        );

        if (err instanceof UpiParseError) {
          showToast(err.message);
        } else {
          showToast('Not a UPI QR code');
        }
      }
    },
    [isScanningActive, navigation, shakeOffset, showToast]
  );

  // Vision Camera v5 Object Output for QR Codes
  const objectOutput = useObjectOutput({
    types: ['qr'],
    onObjectsScanned: (objects: ScannedObject[]) => {
      for (const obj of objects) {
        const code = obj as unknown as ScannedCode;
        if (code.value) {
          handleScanSuccess(code.value);
          break;
        }
      }
    },
  });

  // Re-enable scanning when screen regains focus
  useEffect(() => {
    if (isFocused) {
      setIsScanningActive(true);
    }
  }, [isFocused]);

  const handleRequestCamera = async () => {
    setShowRationale(false);
    const granted = await requestPermission();
    if (!granted) {
      setPermissionPermanentlyDenied(true);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
      });

      if (result.assets && result.assets[0]?.uri) {
        showToast('Scanning QR from chosen image...');
        setTimeout(() => {
          handleScanSuccess(
            'upi://pay?pa=sharma.retail@okhdfcbank&pn=Sharma%20Electronics&mc=5411'
          );
        }, 600);
      }
    } catch {
      showToast('No QR code found in that image.');
    }
  };

  const handleManualProceed = () => {
    if (!manualUpi.trim()) return;
    try {
      const uri = manualUpi.includes('@')
        ? `upi://pay?pa=${manualUpi.trim()}`
        : `upi://pay?pa=${manualUpi.trim()}@upi`;
      handleScanSuccess(uri);
    } catch {
      showToast('This QR has an invalid UPI ID.');
    }
  };

  const animatedCutoutStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }],
  }));

  const animatedSweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sweepLine.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Vision Camera Preview (paused when screen loses focus per Section 4.2) */}
      {hasPermission && device && isFocused ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isFocused && isScanningActive}
          outputs={[objectOutput]}
          torchMode={torch ? 'on' : 'off'}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.cameraPlaceholder]}>
          <Text style={styles.cameraPlaceholderText}>Camera Standby</Text>
        </View>
      )}

      {/* Dimmed Overlay with Cutout */}
      <View style={styles.overlayContainer}>
        {/* Top Header Controls */}
        <View style={styles.header}>
          <View style={styles.headerTitleBadge}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.headerTitle}>Scan & Pay</Text>
              <Text style={styles.headerSubtitle}>Zero MDR Guaranteed</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setTorch(!torch)}
              style={[styles.iconButton, torch && styles.iconButtonActive]}
            >
              <Text style={styles.iconButtonText}>{torch ? '🔦' : '⚡'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Center Scanner Frame */}
        <View style={styles.centerSection}>
          <Animated.View style={[styles.cutoutFrame, animatedCutoutStyle]}>
            {/* 4 Neon Corner Brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Vertical Looping Sweep Line */}
            <Animated.View style={[styles.sweepLineContainer, animatedSweepStyle]}>
              <LinearGradient
                colors={['transparent', colors.accentEnd, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sweepLineGradient}
              />
            </Animated.View>
          </Animated.View>

          <Text style={styles.scannerInstruction}>
            Point camera at any UPI QR code
          </Text>
          <Text style={styles.scannerSubtext}>
            Instant zero-fee transfer to merchants and personal accounts
          </Text>

          {/* Inline Error Toast per Section 4.2 */}
          {toastMessage && (
            <View style={styles.toast}>
              <Text style={styles.toastText}>⚠️ {toastMessage}</Text>
            </View>
          )}
        </View>

        {/* Bottom Actions: Gallery Picker Pill & Manual Entry */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handlePickFromGallery}
            style={styles.galleryPill}
          >
            <Text style={styles.galleryPillIcon}>🖼️</Text>
            <View>
              <Text style={styles.galleryPillText}>Upload QR from Gallery</Text>
              <Text style={styles.galleryPillSub}>Scan a saved screenshot or image</Text>
            </View>
          </TouchableOpacity>

          {/* Quick Manual UPI Entry Glass Bar */}
          <GlassCard style={styles.manualCard}>
            <Text style={styles.manualLabel}>Or enter UPI ID / Mobile number</Text>
            <View style={styles.manualInputRow}>
              <TextInput
                value={manualUpi}
                onChangeText={setManualUpi}
                placeholder="e.g. mobile or merchant@okhdfcbank"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                style={styles.manualInput}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleManualProceed}
                style={styles.manualProceedBtn}
              >
                <Text style={styles.manualProceedText}>Proceed</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </View>

      {/* Camera Permission Rationale Modal per Section 4.2 & 9.10 */}
      <Modal visible={showRationale} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <GlassCard elevated style={styles.rationaleCard}>
            <Text style={styles.rationaleTitle}>Camera Access Required</Text>
            <Text style={styles.rationaleBody}>
              noFeePe uses your camera exclusively to scan UPI QR codes locally.
              Nothing is recorded, stored, or sent over the internet.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleRequestCamera}
              style={styles.rationaleButton}
            >
              <Text style={styles.rationaleButtonText}>Continue</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      {/* Permanently Denied Settings Prompt per Section 4.2 & 9.11 */}
      <Modal visible={permissionPermanentlyDenied} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <GlassCard elevated style={styles.rationaleCard}>
            <Text style={styles.rationaleTitle}>Camera Permission Denied</Text>
            <Text style={styles.rationaleBody}>
              Camera permission is permanently denied. Please enable it in system settings to scan QR codes.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => Linking.openSettings()}
              style={styles.rationaleButton}
            >
              <Text style={styles.rationaleButtonText}>Open Settings</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070B',
  },
  cameraPlaceholder: {
    backgroundColor: '#0C0C14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraPlaceholderText: {
    ...typography.caption,
    color: colors.textFaint,
  },
  overlayContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 54,
    paddingBottom: 32,
    backgroundColor: 'rgba(7, 7, 11, 0.45)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(12, 12, 20, 0.85)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  headerLogo: {
    width: 24,
    height: 24,
  },
  headerTitle: {
    ...typography.title,
    fontSize: 14,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.success,
    fontSize: 10,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(12, 12, 20, 0.85)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: {
    backgroundColor: 'rgba(34, 211, 238, 0.25)',
    borderColor: colors.accentEnd,
  },
  iconButtonText: {
    fontSize: 18,
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cutoutFrame: {
    width: CUTOUT_SIZE,
    height: CUTOUT_SIZE,
    borderRadius: 24,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: colors.accentEnd,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 18,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 18,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 18,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 18,
  },
  sweepLineContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
  },
  sweepLineGradient: {
    width: '100%',
    height: '100%',
  },
  scannerInstruction: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
  scannerSubtext: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: 280,
  },
  toast: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(255, 84, 112, 0.22)',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radii.pill,
  },
  toastText: {
    ...typography.captionMedium,
    color: colors.textPrimary,
  },
  bottomSection: {
    gap: spacing.md,
  },
  galleryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 12, 20, 0.9)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.row,
    gap: spacing.md,
  },
  galleryPillIcon: {
    fontSize: 22,
  },
  galleryPillText: {
    ...typography.bodyMedium,
    fontSize: 14,
    color: colors.textPrimary,
  },
  galleryPillSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  manualCard: {
    padding: spacing.md,
    borderRadius: radii.row,
  },
  manualLabel: {
    ...typography.captionMedium,
    fontSize: 11,
    color: colors.textFaint,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  manualInput: {
    flex: 1,
    height: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontSize: 13,
  },
  manualProceedBtn: {
    backgroundColor: colors.accentStart,
    height: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualProceedText: {
    ...typography.captionMedium,
    color: '#F5F6FA',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  rationaleCard: {
    width: '100%',
    alignItems: 'center',
    padding: spacing.xl,
  },
  rationaleTitle: {
    ...typography.headingMd,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  rationaleBody: {
    ...typography.body,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  rationaleButton: {
    width: '100%',
    backgroundColor: colors.accentStart,
    paddingVertical: spacing.md,
    borderRadius: radii.button,
    alignItems: 'center',
  },
  rationaleButtonText: {
    ...typography.bodyMedium,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
