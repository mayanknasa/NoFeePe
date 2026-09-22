import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { AppIcon } from '../components/AppIcon';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

/**
 * Brand Moment Splash Screen.
 * Implements Section 4.1 of AGENTS.md:
 * - Pure black canvas `#000000`.
 * - Centered logo mark with animated gradient sweep.
 * - Bottom credit line: 'Developed by Mayank Nasa'.
 * - Duration: exactly 1.8 seconds, then navigation.replace('Scanner').
 */
export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const sweepPosition = useSharedValue(-width);
  const logoScale = useSharedValue(0.9);
  const contentOpacity = useSharedValue(0);

  useEffect(() => {
    // Fade in content
    contentOpacity.value = withTiming(1, { duration: 400 });
    logoScale.value = withTiming(1, { duration: 600 });

    // Animated gradient sweep bar looping over the duration
    sweepPosition.value = withRepeat(
      withTiming(width, {
        duration: 1200,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      }),
      -1,
      false,
    );

    // Hard ceiling: max 1.8 seconds per Section 4.1, then replace with Scanner
    const timer = setTimeout(() => {
      navigation.replace('Scanner');
    }, 1800);

    return () => {
      clearTimeout(timer);
      cancelAnimation(sweepPosition);
      cancelAnimation(logoScale);
      cancelAnimation(contentOpacity);
    };
  }, [navigation, sweepPosition, logoScale, contentOpacity]);

  const animatedSweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweepPosition.value }],
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Centered Brand Block */}
      <Animated.View style={[styles.centerBlock, animatedContentStyle]}>
        <View style={styles.logoFrame}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.brandTitle}>NoFee<Text style={styles.brandAccent}>Pe</Text></Text>
        <Text style={styles.brandSubtitle}>Intelligent Zero-MDR UPI Payments</Text>

        {/* Animated gradient sweep bar */}
        <View style={styles.sweepTrack}>
          <Animated.View style={[styles.sweepLine, animatedSweepStyle]}>
            <LinearGradient
              colors={['transparent', '#7C5CFF', '#00D9F5', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sweepGradient}
            />
          </Animated.View>
        </View>
      </Animated.View>

      {/* Footer credit line matching Section 4.1 */}
      <View style={styles.footer}>
        <View style={styles.securityBadge}>
          <AppIcon name="lock" size={11} color="#5A5F73" />
          <Text style={styles.securityText}>
            Zero MDR Protection • Direct Bank Handoff
          </Text>
        </View>
        <Text style={styles.creditLine}>Developed by Mayank Nasa</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // Pure black canvas per Section 4.1
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFrame: {
    width: 104,
    height: 104,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 10,
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 18,
  },
  brandTitle: {
    ...typography.headingLg,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: colors?.accentEnd ?? '#00D9F5',
  },
  brandSubtitle: {
    ...typography.captionMedium,
    color: colors?.textMuted ?? '#8E92A8',
    marginTop: spacing.xs,
    letterSpacing: 0.2,
  },
  sweepTrack: {
    width: 140,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii?.pill ?? 9999,
    overflow: 'hidden',
    marginTop: spacing.xl,
  },
  sweepLine: {
    width: 100,
    height: '100%',
  },
  sweepGradient: {
    width: '100%',
    height: '100%',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
    gap: spacing.sm,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii?.pill ?? 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  securityText: {
    ...typography.caption,
    fontSize: 11,
    color: colors?.textFaint ?? '#5A5F73',
  },
  creditLine: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: '#5A5F73', // Exact hex from Section 4.1
    fontWeight: '500',
  },
});
