import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { StyleSheet, View } from 'react-native';

import { OutcomeChips } from '@/components/outcome-chips';
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
      <OutcomeChips outcome={log.outcome} onOutcome={onOutcome} />
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
});
