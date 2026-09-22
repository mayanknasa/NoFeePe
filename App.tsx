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
import { HistoryScreen } from './src/screens/HistoryScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { ErrorBoundary } from './src/components/ErrorBoundary';

/**
 * Root Stack Navigator definition for NoFeePe.
 * Implements native stack transitions with hardware-accelerated animations.
 */
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * App-wide navigation theme tokens matching the glassmorphic dark palette.
 */
const appNavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors?.bgBase ?? '#07070B',
    card: colors?.bgElevated ?? '#13141F',
    text: colors?.textPrimary ?? '#FFFFFF',
    border: colors?.glassBorder ?? 'rgba(255, 255, 255, 0.08)',
    primary: colors?.accentStart ?? '#00F5A0',
  },
};

/**
 * Main Application Root Component.
 * - Wrapped with ErrorBoundary to prevent any uncaught JavaScript crashes from killing the app.
 * - Configures transparent status bar with light content for immersive OLED dark theme.
 * - Sets up Stack.Navigator with primary routes including Transaction History and About.
 */
export default function App(): React.JSX.Element {
  React.useEffect(() => {
    try {
      StatusBar.setBarStyle('light-content');
    } catch (err: unknown) {
      console.warn('[App] Failed to set StatusBar style:', err);
    }
  }, []);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" />
        <NavigationContainer theme={appNavigationTheme}>
          <Stack.Navigator
            initialRouteName="Splash"
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: colors?.bgBase ?? '#07070B' },
            }}
          >
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Scanner" component={ScannerScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="About" component={AboutScreen} />
            <Stack.Screen name="Amount" component={AmountScreen} />
            <Stack.Screen name="Method" component={MethodScreen} />
            <Stack.Screen name="Pay" component={PayScreen} />
            <Stack.Screen name="Success" component={SuccessScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
