import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Camera, CameraDevice } from 'react-native-vision-camera';
import { realUpiIntent } from '../native/upiIntent';

export interface ScannerCameraProps {
  device: CameraDevice;
  isActive: boolean;
  torch: boolean;
  onScanSuccess: (value: string) => void;
}

/**
 * Android Camera Viewfinder Implementation.
 * Uses VisionCamera v5 TextureView with background snapshot frame sampling
 * processed via Google ML Kit in the native Kotlin module.
 */
export const ScannerCamera: React.FC<ScannerCameraProps> = ({
  device,
  isActive,
  torch,
  onScanSuccess,
}) => {
  const cameraRef = useRef<any>(null);
  const isScanningRef = useRef<boolean>(false);
  const callbackRef = useRef(onScanSuccess);
  callbackRef.current = onScanSuccess;
  const [isCameraReady, setIsCameraReady] = useState<boolean>(false);

  useEffect(() => {
    if (!isActive || !isCameraReady) return;

    const interval = setInterval(async () => {
      if (isScanningRef.current) return;
      if (!cameraRef?.current) return;

      try {
        isScanningRef.current = true;
        // Take a lightweight frame snapshot
        const cameraObj = cameraRef.current as unknown as {
          preview?: {
            takeSnapshot?: () => Promise<{
              saveToTemporaryFileAsync?: (format: string, quality: number) => Promise<string>;
            }>;
          };
        };
        const snapshot = await cameraObj?.preview?.takeSnapshot?.();
        if (snapshot) {
          const tempPath = await snapshot?.saveToTemporaryFileAsync?.('jpg', 80);
          if (tempPath) {
            const qrText = await realUpiIntent?.scanQr?.(tempPath);
            if (qrText && qrText.trim().length > 0) {
              callbackRef?.current?.(qrText.trim());
            }
          }
        }
      } catch {
        // No QR detected in this frame or camera busy - continue sampling safely
      } finally {
        isScanningRef.current = false;
      }
    }, 750);

    return () => clearInterval(interval);
  }, [isActive, isCameraReady]);

  return (
    <Camera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      implementationMode="compatible"
      resizeMode="cover"
      onStarted={() => {
        try {
          setIsCameraReady(true);
        } catch {}
      }}
      onPreviewStarted={() => {
        try {
          setIsCameraReady(true);
        } catch {}
      }}
      onError={(err: Error) => {
        // Prevent camera lifecycle cancel logs from showing warnings
        console.debug?.('[ScannerCamera.android] Camera error ignored safely:', err?.message);
      }}
      torchMode={isCameraReady && torch ? 'on' : 'off'}
    />
  );
};
