import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { TriggerLog, TriggerOutcome } from '@/types/models';

type TriggerLogRowProps = {
  log: TriggerLog;
  label: string;
  onOutcome: (outcome: TriggerOutcome) => void;
};

export function TriggerLogRow({ log, label, onOutcome }: TriggerLogRowProps) {
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const icon = useThemeColor({}, 'icon');
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');

  const chip = (outcome: TriggerOutcome, text: string, color: string) => {
    const selected = log.outcome === outcome;
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onOutcome(outcome)}
        style={[styles.chip, { borderColor: selected ? color : border }]}>
        <ThemedText
          type="caption"
          style={selected ? { color, fontWeight: '600' } : undefined}>
          {text}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <View style={[styles.row, { backgroundColor: card, borderColor: border }]}>
      <View style={styles.info}>
        <ThemedText type="defaultSemiBold">{label}</ThemedText>
        <View style={styles.meta}>
          <Ionicons
            name={log.source === 'scheduled' ? 'notifications-outline' : 'hand-left-outline'}
            size={13}
            color={icon}
          />
          <ThemedText type="caption">{format(parseISO(log.firedAt), 'EEE p')}</ThemedText>
        </View>
      </View>
      <View style={styles.chips}>
        {chip('helped', 'Helped', success)}
        {chip('didNotHelp', "Didn't", danger)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
  },
  info: {
    flex: 1,
    gap: Spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.sm + Spacing.xs,
    paddingVertical: Spacing.xs,
  },
});
