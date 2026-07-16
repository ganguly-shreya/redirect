import { isToday, parseISO } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getCollection, getItem } from '@/lib/storage';
import type { CheckInTime } from '@/types/models';

// All scheduling lives in this file so a future calendar integration (or a
// settings screen for editing times) only has to call
// rescheduleAllNotifications() with new inputs. Local notifications only:
// remote push is unsupported in Expo Go since SDK 53 and this app has no
// backend to send it.

export const STUCK_URL = '/stuck';
export const RETRO_URL = '/retro';

const CHANNEL_ID = 'check-ins';
const RECAP_IDENTIFIER = 'daily-recap';

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

type RescheduleInput = {
  checkInTimes: CheckInTime[];
  recapTime: CheckInTime;
  todayRedirectCount: number;
};

function recapBody(count: number): string {
  if (count === 0) return 'Take a minute to see how today went.';
  if (count === 1) return 'You caught yourself and redirected once today — that’s a win. 🎉';
  return `You caught yourself and redirected ${count} times today — ${count} wins. 🎉`;
}

// Cancel-all + reschedule everything: this app owns every scheduled
// notification, so that stays strictly simpler than reconciling ids.
// The recap is a one-shot at the next recap time. Local notifications can't
// compute content at fire time, so the count is baked in here and refreshed on
// every log write / app foreground (refreshScheduledNotifications). If the next
// occurrence is tomorrow, today's count doesn't apply — the generic body is
// used until tomorrow's redirects update it.
export async function rescheduleAllNotifications({
  checkInTimes,
  recapTime,
  todayRedirectCount,
}: RescheduleInput): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const time of checkInTimes) {
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

  const now = new Date();
  const fireDate = new Date(now);
  fireDate.setHours(recapTime.hour, recapTime.minute, 0, 0);
  const firesToday = fireDate > now;
  if (!firesToday) fireDate.setDate(fireDate.getDate() + 1);
  await Notifications.scheduleNotificationAsync({
    identifier: RECAP_IDENTIFIER,
    content: {
      title: 'Your daily recap',
      body: recapBody(firesToday ? todayRedirectCount : 0),
      data: { url: RETRO_URL },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireDate,
      channelId: CHANNEL_ID,
    },
  });
}

// Recomputes today's redirect count from storage and reschedules everything.
// Called after every TriggerLog write and on app foreground, so the one-shot
// recap rolls forward each day the app is used. No-op for pre-V2 installs that
// never chose a recap time. Accepted limitation: on a day the app is never
// opened, no recap fires — there are no wins to report, and check-ins still nudge.
export async function refreshScheduledNotifications(): Promise<void> {
  const [checkInTimes, recapTime, logs] = await Promise.all([
    getItem('checkInTimes'),
    getItem('recapTime'),
    getCollection('triggerLogs'),
  ]);
  if (!checkInTimes || !recapTime) return;
  const todayRedirectCount = logs.filter((log) => isToday(parseISO(log.firedAt))).length;
  await rescheduleAllNotifications({ checkInTimes, recapTime, todayRedirectCount });
}
