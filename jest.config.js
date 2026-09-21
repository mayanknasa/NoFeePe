module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-navigation|react-native-screens|react-native-safe-area-context|react-native-linear-gradient|react-native-reanimated|react-native-worklets|react-native-vision-camera|react-native-haptic-feedback)/)',
  ],
};
