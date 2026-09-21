/* eslint-disable no-undef */
jest.mock('react-native-worklets', () => {
  return require('react-native-worklets/lib/module/mock');
});

jest.mock('react-native-reanimated/src/ReanimatedModule', () => ({
  ReanimatedModule: new Proxy({}, {
    get: () => () => {},
  }),
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('react-native-screens', () => {
  const { View } = require('react-native');
  return {
    enableScreens: jest.fn(),
    enableFreeze: jest.fn(),
    screensEnabled: jest.fn(() => true),
    compatibilityFlags: {
      usesNewAndroidHeaderHeightImplementation: true,
    },
    Screen: View,
    ScreenContainer: View,
    ScreenStack: View,
    ScreenStackItem: View,
    NativeScreen: View,
    NativeScreenContainer: View,
    NativeScreenStack: View,
    ScreenStackHeaderConfig: View,
    ScreenStackHeaderSubview: View,
    SearchBar: View,
    FullWindowOverlay: View,
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaConsumer: ({ children }: any) => children(inset),
    SafeAreaInsetsContext: React.createContext(inset),
    SafeAreaFrameContext: React.createContext(frame),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
  };
});

jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCameraDevice: () => ({ id: 'back' }),
  useCameraPermission: () => ({ hasPermission: true, requestPermission: jest.fn() }),
  useObjectOutput: () => ({}),
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
