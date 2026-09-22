import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CameraDevice } from 'react-native-vision-camera';

export interface ScannerCameraProps {
  device: CameraDevice;
  isActive: boolean;
  torch: boolean;
  onScanSuccess: (value: string) => void;
}

/**
 * Fallback Web/Unsupported Platform Camera Placeholder.
 */
export const ScannerCamera: React.FC<ScannerCameraProps> = () => {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>Camera Scanner</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#07070B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#8E92A8',
    fontSize: 14,
  },
});
