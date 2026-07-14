import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { CheckInTime } from '@/types/models';

// All scheduling lives in this file so a future calendar integration (or a
// settings screen for editing check-in times) only has to call
// rescheduleCheckIns() with a new list. Local notifications only: remote push
// is unsupported in Expo Go since SDK 53 and this app has no backend to send it.

export const STUCK_URL = '/stuck';

const CHANNEL_ID = 'check-ins';

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    // On Android 13+ the system permission prompt won't appear until at least
    // one notification channel exists, so the channel is created first.
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Daily check-ins',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function cancelAllCheckIns(): Promise<void> {
  // This app owns every scheduled notification, so cancel-all is simpler and
  // safer than persisting and reconciling per-notification ids.
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function rescheduleCheckIns(times: CheckInTime[]): Promise<void> {
  await cancelAllCheckIns();
  for (const time of times) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Redirect check-in',
        body: 'Feeling stuck? Run one of your if-then plans.',
        data: { url: STUCK_URL },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: time.hour,
        minute: time.minute,
        channelId: CHANNEL_ID,
      },
    });
  }
}
