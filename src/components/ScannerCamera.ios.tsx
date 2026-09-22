import React from 'react';
import { StyleSheet } from 'react-native';
import {
  Camera,
  CameraDevice,
  useObjectOutput,
  ScannedObject,
  ScannedCode,
} from 'react-native-vision-camera';

export interface ScannerCameraProps {
  device: CameraDevice;
  isActive: boolean;
  torch: boolean;
  onScanSuccess: (value: string) => void;
}

/**
 * iOS Camera Viewfinder Implementation.
 * Uses VisionCamera v5 useObjectOutput with hardware-accelerated QR code detection.
 */
export const ScannerCamera: React.FC<ScannerCameraProps> = ({
  device,
  isActive,
  torch,
  onScanSuccess,
}) => {
  const objectOutput = useObjectOutput({
    types: ['qr'],
    onObjectsScanned: (objects: ScannedObject[]) => {
      try {
        if (!Array.isArray(objects)) return;
        for (const obj of objects) {
          const code = obj as unknown as ScannedCode;
          if (code?.value) {
            onScanSuccess?.(code.value);
            break;
          }
        }
      } catch (err: unknown) {
        console.warn('[ScannerCamera.ios] onObjectsScanned error:', err);
      }
    },
  });

  return (
    <Camera
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      outputs={[objectOutput]}
      torchMode={torch ? 'on' : 'off'}
    />
  );
};
