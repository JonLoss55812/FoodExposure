import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ConvexProvider } from '../src/providers/ConvexProvider';
import { QueryProvider } from '../src/providers/QueryProvider';
import { DatabaseProvider } from '../src/providers/DatabaseProvider';
import { initSentry } from '../src/lib/sentry';
import { initPostHog } from '../src/lib/posthog';

// Import Unistyles theme registration (side effect)
import '../src/styles/theme';

SplashScreen.preventAutoHideAsync();
initSentry();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
    initPostHog();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConvexProvider>
        <QueryProvider>
          <DatabaseProvider>
            <StatusBar style="auto" />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="child" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen name="food" options={{ headerShown: false, presentation: 'modal' }} />
              <Stack.Screen
                name="onboarding"
                options={{ headerShown: false, gestureEnabled: false }}
              />
            </Stack>
          </DatabaseProvider>
        </QueryProvider>
      </ConvexProvider>
    </GestureHandlerRootView>
  );
}
