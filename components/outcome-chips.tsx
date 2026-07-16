import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { TriggerOutcome } from '@/types/models';

type OutcomeChipsProps = {
  outcome: TriggerOutcome | null | undefined;
  onOutcome: (outcome: TriggerOutcome) => void;
};

// The Helped / Didn't pair. Lives on the execute screen (tag in the moment)
// and on Retro rows (fallback for runs that weren't tagged live).
export function OutcomeChips({ outcome, onOutcome }: OutcomeChipsProps) {
  const border = useThemeColor({}, 'border');
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');

  const chip = (value: TriggerOutcome, text: string, color: string) => {
    const selected = outcome === value;
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => onOutcome(value)}
        style={[styles.chip, { borderColor: selected ? color : border }]}>
        <ThemedText type="caption" style={selected ? { color, fontWeight: '600' } : undefined}>
          {text}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <View style={styles.chips}>
      {chip('helped', 'Helped', success)}
      {chip('didNotHelp', "Didn't", danger)}
    </View>
  );
}

const styles = StyleSheet.create({
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
