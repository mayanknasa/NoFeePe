module.exports = function (api) {
  const isProd = api.env('production') || process.env.NODE_ENV === 'production';
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      'react-native-reanimated/plugin',
      ...(isProd ? ['transform-remove-console'] : []),
    ],
  };
};
