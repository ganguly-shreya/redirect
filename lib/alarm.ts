import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';

const ALARM_SOURCE = require('../assets/sounds/timer-alarm.wav');

const VIBRATION_PATTERN = [0, 500, 300, 500, 300, 500];

// The alert nags until acknowledged (Done / Helped / Didn't) so a face-down
// phone can't sleep through it, but never longer than this.
const MAX_ALERT_MS = 10 * 60_000;

// Module-level player, lazily created and reused for the app's lifetime: a
// hook-based player would be released when the countdown unmounts (the execute
// screen swaps to the celebration view on completion), cutting the alarm off
// before it's audible.
let player: AudioPlayer | null = null;
let stopTimeout: ReturnType<typeof setTimeout> | null = null;
// Guards the awaits in playTimerCompletionAlert: a stop that lands mid-setup
// must win, not be overridden by the play() that follows.
let active = false;

// The ringer decides how completion is announced: sound plays through the
// normal channel (playsInSilentMode: false), so a silenced phone gets only
// the vibration/haptic while a ringing phone gets both.
export async function playTimerCompletionAlert(): Promise<void> {
  active = true;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  Vibration.vibrate(VIBRATION_PATTERN, true);
  if (stopTimeout) clearTimeout(stopTimeout);
  stopTimeout = setTimeout(stopTimerCompletionAlert, MAX_ALERT_MS);
  try {
    await setAudioModeAsync({ playsInSilentMode: false });
    if (!player) player = createAudioPlayer(ALARM_SOURCE);
    player.loop = true;
    await player.seekTo(0);
    if (!active) return;
    player.play();
  } catch (error) {
    // Vibration already fired; a sound failure shouldn't break completion.
    console.warn('Timer alarm failed to play', error);
  }
}

export function stopTimerCompletionAlert(): void {
  active = false;
  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }
  Vibration.cancel();
  player?.pause();
}
