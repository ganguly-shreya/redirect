import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { format, set } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { CheckInTime } from '@/types/models';

type TimePickerRowProps = {
  time: CheckInTime;
  onChange: (time: CheckInTime) => void;
  onRemove?: () => void;
  label?: string;
};

function toDate(time: CheckInTime): Date {
  return set(new Date(), { hours: time.hour, minutes: time.minute, seconds: 0, milliseconds: 0 });
}

// iOS renders the compact inline picker; Android's picker is a dialog, so there
// it's a Pressable showing the time that opens the dialog on demand.
export function TimePickerRow({
  time,
  onChange,
  onRemove,
  label = 'Daily check-in',
}: TimePickerRowProps) {
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const icon = useThemeColor({}, 'icon');
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const handleChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowAndroidPicker(false);
    if (event.type === 'set' && date) {
      onChange({ hour: date.getHours(), minute: date.getMinutes() });
    }
  };

  return (
    <View style={[styles.row, { backgroundColor: card, borderColor: border }]}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {Platform.OS === 'ios' ? (
        <DateTimePicker mode="time" value={toDate(time)} onChange={handleChange} />
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowAndroidPicker(true)}
            style={styles.androidTime}>
            <ThemedText type="defaultSemiBold">{format(toDate(time), 'p')}</ThemedText>
          </Pressable>
          {showAndroidPicker && (
            <DateTimePicker mode="time" value={toDate(time)} onChange={handleChange} />
          )}
        </>
      )}
      {onRemove && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Remove check-in time"
          hitSlop={8}
          onPress={onRemove}>
          <Ionicons name="close" size={20} color={icon} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + Spacing.xs,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
  },
  label: {
    flex: 1,
  },
  androidTime: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
});
