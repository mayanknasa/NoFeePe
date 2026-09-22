import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';
import { colors, radii, spacing, motion } from '../theme/tokens';

interface ProgressBarProps {
  progress: number; // 0 to 1
  totalSegments?: number;
  completedSegments?: number;
  style?: StyleProp<ViewStyle>;
  segmented?: boolean;
}

/**
 * Animated Progress Bar component per Section 4.5 and Section 12.
 * Animates smoothly over 300ms with bezier easing and zero spring overshoot.
 * Supports continuous linear fill or segmented installment steps.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  totalSegments,
  completedSegments,
  style,
  segmented = false,
}) => {
  // Clamp progress strictly between 0 and 1; handle NaN gracefully
  const safeProgress = typeof progress === 'number' && !isNaN(progress) ? progress : 0;
  const clampedProgress = Math.min(Math.max(safeProgress, 0), 1);
  const animatedProgress = useSharedValue(clampedProgress);

  useEffect(() => {
    try {
      animatedProgress.value = withTiming(clampedProgress, {
        duration: motion?.progressDuration ?? 300,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      });
    } catch (err: unknown) {
      console.warn('[ProgressBar] Animation error:', err);
    }
  }, [clampedProgress, animatedProgress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: `${(animatedProgress.value ?? 0) * 100}%`,
    };
  });

  if (segmented && totalSegments && totalSegments > 1) {
    const segments = Array.from({ length: totalSegments }, (_, i) => i);
    return (
      <View style={[styles.segmentedContainer, style]}>
        {segments.map((idx) => {
          const isCompleted = typeof completedSegments === 'number' && idx < completedSegments;
          const isCurrent = typeof completedSegments === 'number' && idx === completedSegments;

          return (
            <View key={idx} style={styles.segmentTrack}>
              {isCompleted ? (
                <LinearGradient
                  colors={[...(colors?.accentGradient ?? ['#00F5A0', '#00D9F5'])]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.segmentFill}
                />
              ) : isCurrent ? (
                <View style={[styles.segmentFill, { backgroundColor: colors?.pending ?? '#8E92A8' }]} />
              ) : null}
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.track, style]}>
      <Animated.View style={[styles.fillContainer, animatedStyle]}>
        <LinearGradient
          colors={[...(colors?.accentGradient ?? ['#00F5A0', '#00D9F5'])]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradientFill}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii?.pill ?? 9999,
    overflow: 'hidden',
    width: '100%',
  },
  fillContainer: {
    height: '100%',
    borderRadius: radii?.pill ?? 9999,
    overflow: 'hidden',
  },
  gradientFill: {
    width: '100%',
    height: '100%',
  },
  segmentedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.xs,
  },
  segmentTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: radii?.pill ?? 9999,
    overflow: 'hidden',
  },
  segmentFill: {
    width: '100%',
    height: '100%',
  },
});
