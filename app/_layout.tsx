import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { OnboardingProvider, useOnboardingStatus } from '@/hooks/use-onboarding-status';

SplashScreen.preventAutoHideAsync();

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

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

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
