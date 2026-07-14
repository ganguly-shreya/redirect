import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { ActionConfig, ActionType } from '@/types/models';

export type PlanFormValue = {
  triggerDescription: string;
  actionType: ActionType;
  actionConfig: ActionConfig;
};

type PlanFormProps = {
  value: PlanFormValue;
  onChange: (value: PlanFormValue) => void;
};

const ACTION_TYPES: { type: ActionType; label: string }[] = [
  { type: 'timer', label: 'Timer' },
  { type: 'visionBoard', label: 'Vision board' },
  { type: 'customMessage', label: 'Message' },
];

export function isPlanFormValueValid(value: PlanFormValue): boolean {
  if (value.triggerDescription.trim().length === 0) return false;
  switch (value.actionType) {
    case 'timer':
      return (value.actionConfig.durationMinutes ?? 0) > 0;
    case 'visionBoard':
      return true;
    case 'customMessage':
      return (value.actionConfig.message ?? '').trim().length > 0;
    default: {
      // Exhaustiveness guard: a new ActionType fails tsc here until handled.
      const _exhaustive: never = value.actionType;
      return _exhaustive;
    }
  }
}

// Controlled form shared by onboarding (accept/customize a suggested plan) and
// the Plans tab (create/edit). Switching actionType keeps the old config fields
// around so toggling back doesn't lose input; validation only reads the fields
// relevant to the active type.
export function PlanForm({ value, onChange }: PlanFormProps) {
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');

  const setConfig = (patch: Partial<ActionConfig>) =>
    onChange({ ...value, actionConfig: { ...value.actionConfig, ...patch } });

  const renderConfig = () => {
    switch (value.actionType) {
      case 'timer':
        return (
          <View style={styles.field}>
            <ThemedText type="caption">Timer length (minutes)</ThemedText>
            <ThemedTextInput
              keyboardType="number-pad"
              value={value.actionConfig.durationMinutes?.toString() ?? ''}
              onChangeText={(text) => {
                const parsed = parseInt(text, 10);
                setConfig({ durationMinutes: Number.isNaN(parsed) ? undefined : parsed });
              }}
              placeholder="e.g. 10"
            />
          </View>
        );
      case 'visionBoard':
        return (
          <ThemedText type="caption">
            A random image from your vision board will be shown full-screen.
          </ThemedText>
        );
      case 'customMessage':
        return (
          <View style={styles.field}>
            <ThemedText type="caption">Message to show yourself</ThemedText>
            <ThemedTextInput
              multiline
              value={value.actionConfig.message ?? ''}
              onChangeText={(text) => setConfig({ message: text })}
              placeholder="e.g. Done beats perfect. Ship it."
              style={styles.multiline}
            />
          </View>
        );
      default: {
        const _exhaustive: never = value.actionType;
        return _exhaustive;
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        <ThemedText type="caption">If… (what does getting stuck look like?)</ThemedText>
        <ThemedTextInput
          multiline
          value={value.triggerDescription}
          onChangeText={(text) => onChange({ ...value, triggerDescription: text })}
          placeholder="e.g. If I catch myself scrolling mid-work…"
          style={styles.multiline}
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="caption">Then…</ThemedText>
        <View style={styles.segments}>
          {ACTION_TYPES.map(({ type, label }) => {
            const selected = value.actionType === type;
            return (
              <Pressable
                key={type}
                accessibilityRole="button"
                onPress={() => onChange({ ...value, actionType: type })}
                style={[
                  styles.segment,
                  { backgroundColor: card, borderColor: selected ? tint : border },
                  selected && styles.segmentSelected,
                ]}>
                <ThemedText type={selected ? 'defaultSemiBold' : 'default'}>{label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {renderConfig()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  field: {
    gap: Spacing.xs,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  segments: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm + Spacing.xs,
  },
  segmentSelected: {
    borderWidth: 2,
  },
});
