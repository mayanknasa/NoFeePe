import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, radii, spacing, typography } from '../theme/tokens';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC<Props> = ({ navigation }) => {
  const sweepPosition = useSharedValue(-width);
  const logoScale = useSharedValue(0.9);
  const logoOpacity = useSharedValue(0);

  useEffect(() => {
    // Logo entrance animation
    logoOpacity.value = withTiming(1, { duration: 600 });
    logoScale.value = withTiming(1, {
      duration: 800,
      easing: Easing.out(Easing.back(1.5)),
    });

    // Looping gradient sweep
    sweepPosition.value = withRepeat(
      withTiming(width, {
        duration: 1200,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    // Maximum 1.8s per Section 4.1, then replace with Scanner
    const timer = setTimeout(() => {
      navigation.replace('Scanner');
    }, 1800);

    return () => clearTimeout(timer);
  }, [navigation, logoOpacity, logoScale, sweepPosition]);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const animatedSweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sweepPosition.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Centered Logo and Brand */}
      <Animated.View style={[styles.centerBlock, animatedLogoStyle]}>
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
              colors={['transparent', colors.accentStart, colors.accentEnd, 'transparent']}
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
          <Text style={styles.securityText}>
            🔒 Zero MDR Protection • Direct Bank Handoff
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
    shadowColor: colors.accentStart,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: spacing.lg,
  },
  logoImage: {
    width: 72,
    height: 72,
  },
  brandTitle: {
    ...typography.headingLg,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: colors.accentEnd,
  },
  brandSubtitle: {
    ...typography.captionMedium,
    color: colors.textMuted,
    marginTop: spacing.xs,
    letterSpacing: 0.2,
  },
  sweepTrack: {
    width: 140,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii.pill,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  securityText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
  },
  creditLine: {
    fontSize: 12,
    letterSpacing: 1.2,
    color: '#5A5F73', // Exact hex from Section 4.1
    fontWeight: '500',
  },
});
