import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { useThemeColor } from '@/hooks/use-theme-color';

// Temporary stub: real multi-step wizard lands in steps 3-5.
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const tint = useThemeColor({}, 'tint');
  const { completeOnboarding } = useOnboardingStatus();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ThemedText type="title">Welcome to Redirect</ThemedText>
      <Pressable
        style={[styles.button, { backgroundColor: tint }]}
        onPress={() => completeOnboarding()}>
        <ThemedText lightColor="#FFFFFF" darkColor="#FFFFFF" type="defaultSemiBold">
          Finish (stub)
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.screen,
    gap: Spacing.lg,
  },
  button: {
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
});
