import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type CountdownTimerProps = {
  durationMinutes: number;
  onComplete?: () => void;
};

// Timestamp-based rather than tick-decrement: recomputing from a fixed end time
// means the display can't drift, and stays correct if JS timers are throttled
// while the app is briefly backgrounded.
export function CountdownTimer({ durationMinutes, onComplete }: CountdownTimerProps) {
  const endsAtRef = useRef(Date.now() + durationMinutes * 60_000);
  const [remainingMs, setRemainingMs] = useState(durationMinutes * 60_000);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, endsAtRef.current - Date.now());
      setRemainingMs(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onCompleteRef.current?.();
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <ThemedText style={styles.time}>
      {minutes}:{seconds.toString().padStart(2, '0')}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  time: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
