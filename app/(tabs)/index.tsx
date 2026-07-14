import { format, isToday, parseISO, set } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getCollection, getItem } from '@/lib/storage';
import type { CheckInTime } from '@/types/models';

export default function HomeScreen() {
  const router = useRouter();
  const [times, setTimes] = useState<CheckInTime[]>([]);
  const [todayCount, setTodayCount] = useState(0);

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
});
