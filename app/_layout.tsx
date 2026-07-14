import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { OnboardingProvider, useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { STUCK_URL } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

// shouldShowBanner/shouldShowList are the SDK 54 names (shouldShowAlert is deprecated).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function RootLayout() {
  return (
    <OnboardingProvider>
      <RootNavigator />
    </OnboardingProvider>
  );
}

function RootNavigator() {
  const scheme = useColorScheme() ?? 'light';
  const palette = Colors[scheme];
  const { isLoading, isOnboarded } = useOnboardingStatus();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  // useLastNotificationResponse covers both cold start and foreground taps, so
  // no separate addNotificationResponseReceivedListener is needed. The date
  // dedupe matters because a DAILY notification reuses its request identifier
  // every day; only the delivery date distinguishes taps.
  const response = Notifications.useLastNotificationResponse();
  const handledDate = useRef<number | null>(null);
  useEffect(() => {
    if (!response || isLoading || !isOnboarded) return;
    if (handledDate.current === response.notification.date) return;
    handledDate.current = response.notification.date;
    const data = response.notification.request.content.data as { url?: string };
    if (data.url === STUCK_URL) {
      router.push({ pathname: '/stuck', params: { source: 'scheduled' } });
    }
  }, [response, isLoading, isOnboarded, router]);

  // Splash stays visible until the hasOnboarded flag loads, so users never
  // flash the wrong side of the gate.
  if (isLoading) return null;

  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: {
          ...navTheme.colors,
          primary: palette.tint,
          background: palette.background,
          card: palette.background,
          text: palette.text,
          border: palette.border,
        },
      }}>
      <Stack>
        <Stack.Protected guard={isOnboarded}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="stuck" options={{ presentation: 'modal', title: "I'm Stuck" }} />
          <Stack.Screen
            name="execute/[planId]"
            options={{ presentation: 'fullScreenModal', headerShown: false }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!isOnboarded}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
