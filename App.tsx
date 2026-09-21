import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from './src/types';
import { colors } from './src/theme/tokens';
import { SplashScreen } from './src/screens/SplashScreen';
import { ScannerScreen } from './src/screens/ScannerScreen';
import { AmountScreen } from './src/screens/AmountScreen';
import { MethodScreen } from './src/screens/MethodScreen';
import { PayScreen } from './src/screens/PayScreen';
import { SuccessScreen } from './src/screens/SuccessScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const appNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bgBase,
    card: colors.bgElevated,
    text: colors.textPrimary,
    border: colors.glassBorder,
    primary: colors.accentStart,
  },
};

export default function App(): React.JSX.Element {
  React.useEffect(() => {
    StatusBar.setBarStyle('light-content');
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <NavigationContainer theme={appNavigationTheme}>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.bgBase },
          }}
        >
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Scanner" component={ScannerScreen} />
          <Stack.Screen name="Amount" component={AmountScreen} />
          <Stack.Screen name="Method" component={MethodScreen} />
          <Stack.Screen name="Pay" component={PayScreen} />
          <Stack.Screen name="Success" component={SuccessScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
