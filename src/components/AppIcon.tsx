import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';

export type AppIconName =
  | 'gallery'
  | 'warning'
  | 'info'
  | 'check'
  | 'cross'
  | 'pause'
  | 'card'
  | 'shield'
  | 'history'
  | 'lock'
  | 'download'
  | 'chevronRight'
  | 'copy'
  | 'sparkle';

export interface AppIconProps {
  name: AppIconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Native Vector Icon Component for NoFeePe.
 * Implements bank-grade, pixel-crisp geometric icons with pure React Native primitives.
 * Zero external font or native asset dependencies.
 */
export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = 20,
  color = '#FFFFFF',
  style,
}) => {
  const containerStyle = [
    styles.container,
    { width: size, height: size },
    style,
  ];

  switch (name) {
    case 'gallery': {
      // Photo frame with landscape mountain and sun
      return (
        <View style={containerStyle}>
          <View
            style={[
              styles.galleryFrame,
              { borderColor: color, width: size * 0.9, height: size * 0.8 },
            ]}
          >
            {/* Sun circle */}
            <View
              style={[
                styles.gallerySun,
                {
                  backgroundColor: color,
                  width: size * 0.22,
                  height: size * 0.22,
                  borderRadius: size * 0.11,
                  top: size * 0.1,
                  right: size * 0.12,
                },
              ]}
            />
            {/* Mountain 1 */}
            <View
              style={[
                styles.galleryMountain,
                {
                  borderBottomColor: color,
                  borderLeftWidth: size * 0.22,
                  borderRightWidth: size * 0.22,
                  borderBottomWidth: size * 0.32,
                  left: size * 0.05,
                },
              ]}
            />
            {/* Mountain 2 */}
            <View
              style={[
                styles.galleryMountain,
                styles.galleryMountainSub,
                {
                  borderBottomColor: color,
                  borderLeftWidth: size * 0.18,
                  borderRightWidth: size * 0.18,
                  borderBottomWidth: size * 0.24,
                  right: size * 0.08,
                },
              ]}
            />
          </View>
        </View>
      );
    }

    case 'warning': {
      // Triangle warning sign with exclamation point
      return (
        <View style={containerStyle}>
          <View
            style={[
              styles.triangleOutline,
              {
                borderBottomColor: color,
                borderLeftWidth: size * 0.44,
                borderRightWidth: size * 0.44,
                borderBottomWidth: size * 0.78,
              },
            ]}
          />
          {/* Inner cutout */}
          <View
            style={[
              styles.triangleInner,
              {
                borderLeftWidth: size * 0.34,
                borderRightWidth: size * 0.34,
                borderBottomWidth: size * 0.6,
                top: size * 0.24,
              },
            ]}
          />
          {/* Exclamation stem */}
          <View
            style={[
              styles.exclamationStem,
              {
                backgroundColor: color,
                width: size * 0.09,
                height: size * 0.24,
                top: size * 0.38,
              },
            ]}
          />
          {/* Exclamation dot */}
          <View
            style={[
              styles.exclamationDot,
              {
                backgroundColor: color,
                width: size * 0.09,
                height: size * 0.09,
                borderRadius: size * 0.045,
                bottom: size * 0.16,
              },
            ]}
          />
        </View>
      );
    }

    case 'info': {
      // Circle with lowercase 'i'
      return (
        <View style={containerStyle}>
          <View
            style={[
              styles.circleOutline,
              {
                borderColor: color,
                width: size * 0.9,
                height: size * 0.9,
                borderRadius: (size * 0.9) / 2,
              },
            ]}
          >
            {/* Dot */}
            <View
              style={[
                styles.infoDot,
                {
                  backgroundColor: color,
                  width: size * 0.12,
                  height: size * 0.12,
                  borderRadius: size * 0.06,
                  top: size * 0.18,
                },
              ]}
            />
            {/* Stem */}
            <View
              style={[
                styles.infoStem,
                {
                  backgroundColor: color,
                  width: size * 0.12,
                  height: size * 0.34,
                  bottom: size * 0.18,
                },
              ]}
            />
          </View>
        </View>
      );
    }

    case 'check': {
      // Crisp checkmark
      return (
        <View style={containerStyle}>
          <View
            style={[
              styles.checkmark,
              {
                width: size * 0.35,
                height: size * 0.6,
                borderColor: color,
                borderBottomWidth: size * 0.12,
                borderRightWidth: size * 0.12,
                top: size * 0.1,
              },
            ]}
          />
        </View>
      );
    }

    case 'cross': {
      // Crisp diagonal X
      return (
        <View style={containerStyle}>
          <View
            style={[
              styles.crossBar,
              {
                backgroundColor: color,
                width: size * 0.75,
                height: size * 0.12,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
          <View
            style={[
              styles.crossBar,
              {
                backgroundColor: color,
                width: size * 0.75,
                height: size * 0.12,
                transform: [{ rotate: '-45deg' }],
              },
            ]}
          />
        </View>
      );
    }

    case 'pause': {
      // Two clean vertical pause bars
      return (
        <View style={[containerStyle, styles.pauseRow]}>
          <View
            style={[
              styles.pauseBar,
              {
                backgroundColor: color,
                width: size * 0.18,
                height: size * 0.65,
              },
            ]}
          />
          <View
            style={[
              styles.pauseBar,
              {
                backgroundColor: color,
                width: size * 0.18,
                height: size * 0.65,
                marginLeft: size * 0.18,
              },
            ]}
          />
        </View>
      );
    }

    case 'card': {
      // Bank card with magnetic stripe and chip
      return (
        <View style={containerStyle}>
          <View
            style={[
              styles.cardOutline,
              {
                borderColor: color,
                width: size * 0.95,
                height: size * 0.65,
                borderRadius: size * 0.1,
              },
            ]}
          >
            {/* Magnetic stripe */}
            <View
              style={[
                styles.cardStripe,
                {
                  backgroundColor: color,
                  height: size * 0.15,
                  top: size * 0.1,
                },
              ]}
            />
            {/* Chip outline */}
            <View
              style={[
                styles.cardChip,
                {
                  borderColor: color,
                  width: size * 0.18,
                  height: size * 0.14,
                  bottom: size * 0.08,
                  left: size * 0.1,
                },
              ]}
            />
          </View>
        </View>
      );
    }

    case 'shield': {
      // Security shield outline
      return (
        <View style={containerStyle}>
          <View
            style={[
              styles.shieldFrame,
              {
                borderColor: color,
                width: size * 0.75,
                height: size * 0.85,
                borderTopLeftRadius: size * 0.35,
                borderTopRightRadius: size * 0.35,
                borderBottomLeftRadius: size * 0.45,
                borderBottomRightRadius: size * 0.45,
              },
            ]}
          >
            {/* Inner checkmark inside shield */}
            <View
              style={[
                styles.checkmark,
                {
                  width: size * 0.22,
                  height: size * 0.38,
                  borderColor: color,
                  borderBottomWidth: size * 0.1,
                  borderRightWidth: size * 0.1,
                  top: size * 0.12,
                },
              ]}
            />
          </View>
        </View>
      );
    }

    case 'lock': {
      // Padlock
      return (
        <View style={containerStyle}>
          {/* Shackle */}
          <View
            style={[
              styles.lockShackle,
              {
                borderColor: color,
                width: size * 0.45,
                height: size * 0.45,
                borderTopLeftRadius: (size * 0.45) / 2,
                borderTopRightRadius: (size * 0.45) / 2,
                borderWidth: size * 0.1,
                top: size * 0.05,
              },
            ]}
          />
          {/* Body */}
          <View
            style={[
              styles.lockBody,
              {
                backgroundColor: color,
                width: size * 0.7,
                height: size * 0.48,
                borderRadius: size * 0.08,
                bottom: size * 0.05,
              },
            ]}
          />
        </View>
      );
    }

    case 'download': {
      // Tray with downward arrow
      return (
        <View style={containerStyle}>
          {/* Arrow stem */}
          <View
            style={[
              styles.downloadStem,
              {
                backgroundColor: color,
                width: size * 0.12,
                height: size * 0.45,
                top: size * 0.1,
              },
            ]}
          />
          {/* Arrow tip */}
          <View
            style={[
              styles.downloadTip,
              {
                borderTopColor: color,
                borderLeftWidth: size * 0.2,
                borderRightWidth: size * 0.2,
                borderTopWidth: size * 0.2,
                top: size * 0.45,
              },
            ]}
          />
          {/* Tray bottom bar */}
          <View
            style={[
              styles.downloadTray,
              {
                borderColor: color,
                width: size * 0.75,
                height: size * 0.22,
                borderBottomWidth: size * 0.1,
                borderLeftWidth: size * 0.1,
                borderRightWidth: size * 0.1,
                bottom: size * 0.08,
              },
            ]}
          />
        </View>
      );
    }

    case 'chevronRight': {
      return (
        <View style={containerStyle}>
          <View
            style={[
              styles.chevron,
              {
                width: size * 0.35,
                height: size * 0.35,
                borderTopWidth: size * 0.1,
                borderRightWidth: size * 0.1,
                borderColor: color,
                transform: [{ rotate: '45deg' }],
                marginLeft: -size * 0.1,
              },
            ]}
          />
        </View>
      );
    }

    case 'copy': {
      return (
        <View style={containerStyle}>
          {/* Back sheet */}
          <View
            style={[
              styles.copyBack,
              {
                borderColor: color,
                width: size * 0.55,
                height: size * 0.65,
                top: size * 0.08,
                right: size * 0.1,
                borderWidth: size * 0.08,
                borderRadius: size * 0.06,
              },
            ]}
          />
          {/* Front sheet */}
          <View
            style={[
              styles.copyFront,
              {
                borderColor: color,
                width: size * 0.55,
                height: size * 0.65,
                bottom: size * 0.08,
                left: size * 0.1,
                borderWidth: size * 0.08,
                borderRadius: size * 0.06,
              },
            ]}
          />
        </View>
      );
    }

    case 'history': {
      return (
        <View style={containerStyle}>
          <View
            style={[
              styles.circleOutline,
              {
                borderColor: color,
                width: size * 0.85,
                height: size * 0.85,
                borderRadius: (size * 0.85) / 2,
              },
            ]}
          >
            {/* Clock center hour hand */}
            <View
              style={[
                styles.clockHandHour,
                {
                  backgroundColor: color,
                  width: size * 0.09,
                  height: size * 0.25,
                  top: size * 0.18,
                  left: (size * 0.85 - size * 0.09) / 2 - size * 0.06,
                },
              ]}
            />
            {/* Clock minute hand */}
            <View
              style={[
                styles.clockHandMinute,
                {
                  backgroundColor: color,
                  width: size * 0.22,
                  height: size * 0.09,
                  top: (size * 0.85 - size * 0.09) / 2 - size * 0.06,
                  left: (size * 0.85 - size * 0.09) / 2 - size * 0.06,
                },
              ]}
            />
          </View>
        </View>
      );
    }

    case 'sparkle': {
      return (
        <View style={containerStyle}>
          <View
            style={[
              styles.sparkleDiamond,
              {
                backgroundColor: color,
                width: size * 0.4,
                height: size * 0.4,
                transform: [{ rotate: '45deg' }],
              },
            ]}
          />
        </View>
      );
    }

    default:
      return null;
  }
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  galleryFrame: {
    borderWidth: 1.5,
    borderRadius: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  gallerySun: {
    position: 'absolute',
  },
  galleryMountain: {
    position: 'absolute',
    bottom: 0,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  galleryMountainSub: {
    opacity: 0.8,
  },
  triangleOutline: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  triangleInner: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#07070B',
  },
  exclamationStem: {
    position: 'absolute',
    borderRadius: 1,
  },
  exclamationDot: {
    position: 'absolute',
  },
  circleOutline: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  infoDot: {
    position: 'absolute',
  },
  infoStem: {
    position: 'absolute',
    borderRadius: 1,
  },
  checkmark: {
    transform: [{ rotate: '45deg' }],
  },
  crossBar: {
    position: 'absolute',
    borderRadius: 1,
  },
  pauseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseBar: {
    borderRadius: 1,
  },
  cardOutline: {
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
  },
  cardStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  cardChip: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 2,
  },
  shieldFrame: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  lockShackle: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  lockBody: {
    position: 'absolute',
  },
  downloadStem: {
    position: 'absolute',
    borderRadius: 1,
  },
  downloadTip: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  downloadTray: {
    position: 'absolute',
    borderRadius: 2,
  },
  chevron: {},
  copyBack: {
    position: 'absolute',
  },
  copyFront: {
    position: 'absolute',
    backgroundColor: '#07070B',
  },
  clockHandHour: {
    position: 'absolute',
    borderRadius: 1,
  },
  clockHandMinute: {
    position: 'absolute',
    borderRadius: 1,
  },
  sparkleDiamond: {
    borderRadius: 2,
  },
});
