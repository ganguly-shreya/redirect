import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { format, parseISO, startOfDay } from 'date-fns';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

type DatePickerRowProps = {
  label: string;
  date: string; // ISO 8601
  onChange: (isoDate: string) => void;
};

// Sibling of time-picker-row for calendar dates (goal target dates): iOS shows
// the compact inline picker, Android opens its dialog from a Pressable.
export function DatePickerRow({ label, date, onChange }: DatePickerRowProps) {
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  const value = parseISO(date);

  const handleChange = (event: DateTimePickerEvent, next?: Date) => {
    if (Platform.OS === 'android') setShowAndroidPicker(false);
    if (event.type === 'set' && next) {
      onChange(next.toISOString());
    }
  };

  return (
    <View style={[styles.row, { backgroundColor: card, borderColor: border }]}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          mode="date"
          value={value}
          minimumDate={startOfDay(new Date())}
          onChange={handleChange}
        />
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowAndroidPicker(true)}
            style={styles.androidDate}>
            <ThemedText type="defaultSemiBold">{format(value, 'MMM d, yyyy')}</ThemedText>
          </Pressable>
          {showAndroidPicker && (
            <DateTimePicker
              mode="date"
              value={value}
              minimumDate={startOfDay(new Date())}
              onChange={handleChange}
            />
          )}
        </>
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
  androidDate: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
});
