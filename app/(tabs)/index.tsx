import { format, isToday, parseISO, set } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { useThemeColor } from '@/hooks/use-theme-color';
import { deleteAllImageFiles } from '@/lib/images';
import { cancelAllNotifications } from '@/lib/notifications';
import { clearAllData, getCollection, getItem } from '@/lib/storage';
import type { CheckInTime } from '@/types/models';

export default function HomeScreen() {
  const router = useRouter();
  const { resetOnboarding } = useOnboardingStatus();
  const danger = useThemeColor({}, 'danger');
  const [times, setTimes] = useState<CheckInTime[]>([]);
  const [todayCount, setTodayCount] = useState(0);

  // Dev-only escape hatch for re-testing the full flow: wipes storage, picked
  // image files, and scheduled notifications, then flips the onboarding gate —
  // the router lands back on step 1 without reinstalling Expo Go.
  const confirmDevReset = () => {
    Alert.alert(
      'Reset all data?',
      'Goals, plans, logs, images, and scheduled notifications are wiped and onboarding starts over. Dev only.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await cancelAllNotifications();
            deleteAllImageFiles();
            await clearAllData();
            // Flips the Stack.Protected gate; also re-stamps hasOnboarded=false,
            // which is equivalent to a fresh install for the gate's purposes.
            await resetOnboarding();
          },
        },
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      getItem('checkInTimes').then((stored) => setTimes(stored ?? []));
      getCollection('triggerLogs').then((logs) =>
        setTodayCount(logs.filter((log) => isToday(parseISO(log.firedAt))).length)
      );
    }, [])
  );

  const formatTime = (time: CheckInTime) =>
    format(set(new Date(), { hours: time.hour, minutes: time.minute }), 'p');

  return (
    <ThemedView style={styles.container}>
      <View style={styles.center}>
        <PrimaryButton
          label="I'm Stuck"
          size="large"
          onPress={() => router.push('/stuck')}
        />
        <ThemedText type="caption" style={styles.hint}>
          Tap when you catch yourself in a loop — your plan takes it from there.
        </ThemedText>
      </View>
      <View style={styles.footer}>
        {times.length > 0 && (
          <ThemedText type="caption">
            Today&apos;s check-ins: {times.map(formatTime).join(' · ')}
          </ThemedText>
        )}
        {todayCount > 0 && (
          <ThemedText type="caption">
            Redirected {todayCount} {todayCount === 1 ? 'time' : 'times'} today
          </ThemedText>
        )}
        {__DEV__ && (
          <Pressable
            accessibilityRole="button"
            onPress={confirmDevReset}
            style={styles.devReset}>
            <ThemedText type="caption" style={{ color: danger }}>
              Reset all data (dev)
            </ThemedText>
          </Pressable>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.screen,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  hint: {
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  devReset: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
});
