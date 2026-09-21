module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-reanimated/plugin',
    ...(process.env.NODE_ENV === 'production' ? ['transform-remove-console'] : []),
  ],
};
