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
  // Highlight the fields that keep isPlanFormValueValid false, so a disabled
  // Continue/Save button never leaves the user guessing what's missing.
  showErrors?: boolean;
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
export function PlanForm({ value, onChange, showErrors = false }: PlanFormProps) {
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const danger = useThemeColor({}, 'danger');

  const setConfig = (patch: Partial<ActionConfig>) =>
    onChange({ ...value, actionConfig: { ...value.actionConfig, ...patch } });

  const errorBorder = { borderColor: danger, borderWidth: 1.5 };
  const fieldLabel = (label: string, invalid: boolean) => (
    <ThemedText type="caption" style={invalid ? { color: danger } : undefined}>
      {invalid ? `${label} — required` : label}
    </ThemedText>
  );

  const renderConfig = () => {
    switch (value.actionType) {
      case 'timer': {
        const durationInvalid = showErrors && (value.actionConfig.durationMinutes ?? 0) <= 0;
        return (
          <>
            <View style={styles.field}>
              {fieldLabel('Timer length (minutes)', durationInvalid)}
              <ThemedTextInput
                keyboardType="number-pad"
                value={value.actionConfig.durationMinutes?.toString() ?? ''}
                onChangeText={(text) => {
                  const parsed = parseInt(text, 10);
                  setConfig({ durationMinutes: Number.isNaN(parsed) ? undefined : parsed });
                }}
                placeholder="e.g. 10"
                style={durationInvalid && errorBorder}
              />
            </View>
            <View style={styles.field}>
              <ThemedText type="caption">Message shown with the timer (optional)</ThemedText>
              <ThemedTextInput
                value={value.actionConfig.message ?? ''}
                onChangeText={(text) => setConfig({ message: text })}
                placeholder="e.g. Start with the smallest task when the timer finishes."
              />
            </View>
          </>
        );
      }
      case 'visionBoard':
        return (
          <ThemedText type="caption">Remind me of my vision for the future.</ThemedText>
        );
      case 'customMessage': {
        const messageInvalid =
          showErrors && (value.actionConfig.message ?? '').trim().length === 0;
        return (
          <View style={styles.field}>
            {fieldLabel('Message to show yourself', messageInvalid)}
            <ThemedTextInput
              multiline
              value={value.actionConfig.message ?? ''}
              onChangeText={(text) => setConfig({ message: text })}
              placeholder="e.g. Done beats perfect. Ship it."
              style={[styles.multiline, messageInvalid && errorBorder]}
            />
          </View>
        );
      }
      default: {
        const _exhaustive: never = value.actionType;
        return _exhaustive;
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        {fieldLabel(
          'If… (what does getting stuck look like?)',
          showErrors && value.triggerDescription.trim().length === 0
        )}
        <ThemedTextInput
          multiline
          value={value.triggerDescription}
          onChangeText={(text) => onChange({ ...value, triggerDescription: text })}
          placeholder="e.g. If I catch myself scrolling mid-work…"
          style={[
            styles.multiline,
            showErrors && value.triggerDescription.trim().length === 0 && errorBorder,
          ]}
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
