import { Ionicons } from '@expo/vector-icons';
import { addDays } from 'date-fns';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DatePickerRow } from '@/components/date-picker-row';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { VisionImageGrid } from '@/components/vision-image-grid';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { PRESETS, type PresetDefinition } from '@/lib/presets';
import type { FailurePoint, Quote, VisionBoardImage } from '@/types/models';

// The editable fields of a Goal plus which failure patterns link to it. The
// parent owns persistence: onboarding keeps drafts in local state, the Goals
// tab maps this onto stored Goal + FailurePoint.goalIds.
export type GoalDraft = {
  title: string;
  why: string;
  targetDate: string; // ISO 8601
  imageIds: string[];
  quoteIds: string[];
  failurePointIds: string[];
};

export function createEmptyGoalDraft(): GoalDraft {
  return {
    title: '',
    why: '',
    targetDate: addDays(new Date(), 90).toISOString(),
    imageIds: [],
    quoteIds: [],
    failurePointIds: [],
  };
}

export function isGoalDraftValid(draft: GoalDraft): boolean {
  return draft.title.trim().length > 0 && draft.why.trim().length > 0;
}

type GoalEditorProps = {
  value: GoalDraft;
  onChange: (value: GoalDraft) => void;
  // Shared pools the draft selects from; the editor grows them via callbacks.
  images: VisionBoardImage[];
  onPickImages: () => Promise<VisionBoardImage[]>; // parent picks + persists, returns new pool entries
  quotes: Quote[];
  onAddQuote: (text: string) => Quote;
  failurePoints: FailurePoint[]; // every instantiated pattern (may be linked to other goals)
  onInstantiatePreset: (preset: PresetDefinition) => string; // returns new pattern id
  onAddCustomPattern: (label: string) => string; // returns new pattern id
};

export function GoalEditor({
  value,
  onChange,
  images,
  onPickImages,
  quotes,
  onAddQuote,
  failurePoints,
  onInstantiatePreset,
  onAddCustomPattern,
}: GoalEditorProps) {
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const icon = useThemeColor({}, 'icon');

  const [customQuote, setCustomQuote] = useState('');
  const [customPattern, setCustomPattern] = useState('');

  const toggleId = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter((existing) => existing !== id) : [...ids, id];

  const checkRow = (key: string, label: string, checked: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={[styles.row, { backgroundColor: card, borderColor: checked ? tint : border }]}>
      <Ionicons
        name={checked ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={checked ? tint : icon}
      />
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
    </Pressable>
  );

  const addImages = async () => {
    const added = await onPickImages();
    if (added.length === 0) return;
    onChange({ ...value, imageIds: [...value.imageIds, ...added.map((i) => i.id)] });
  };

  const addQuote = () => {
    const text = customQuote.trim();
    if (!text) return;
    const quote = onAddQuote(text);
    onChange({ ...value, quoteIds: [...value.quoteIds, quote.id] });
    setCustomQuote('');
  };

  const addPattern = () => {
    const label = customPattern.trim();
    if (!label) return;
    const id = onAddCustomPattern(label);
    onChange({ ...value, failurePointIds: [...value.failurePointIds, id] });
    setCustomPattern('');
  };

  const togglePreset = (preset: PresetDefinition) => {
    const existing = failurePoints.find(
      (fp) => fp.isPreset && fp.label === preset.failurePoint.label
    );
    const id = existing?.id ?? onInstantiatePreset(preset);
    onChange({ ...value, failurePointIds: toggleId(value.failurePointIds, id) });
  };

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        <ThemedText type="caption">Goal</ThemedText>
        <ThemedTextInput
          value={value.title}
          onChangeText={(title) => onChange({ ...value, title })}
          placeholder="e.g. Ship my side project"
        />
      </View>
      <View style={styles.field}>
        <ThemedText type="caption">Why does this matter to you?</ThemedText>
        <ThemedTextInput
          value={value.why}
          onChangeText={(why) => onChange({ ...value, why })}
          placeholder="One line — future you will read this mid-spiral."
        />
      </View>
      <DatePickerRow
        label="Target date"
        date={value.targetDate}
        onChange={(targetDate) => onChange({ ...value, targetDate })}
      />

      <View style={styles.section}>
        <ThemedText type="defaultSemiBold">Vision board images</ThemedText>
        <ThemedText type="caption">
          Shown when a linked pattern redirects you. Tap to select.
        </ThemedText>
        <VisionImageGrid
          images={images}
          selectedIds={value.imageIds}
          onToggleSelect={(image) =>
            onChange({ ...value, imageIds: toggleId(value.imageIds, image.id) })
          }
        />
        <PrimaryButton label="Add your own" onPress={addImages} />
      </View>

      <View style={styles.section}>
        <ThemedText type="defaultSemiBold">Quotes</ThemedText>
        <ThemedText type="caption">Words that snap you out of it.</ThemedText>
        {quotes.map((quote) =>
          checkRow(quote.id, quote.text, value.quoteIds.includes(quote.id), () =>
            onChange({ ...value, quoteIds: toggleId(value.quoteIds, quote.id) })
          )
        )}
        <View style={styles.customRow}>
          <ThemedTextInput
            value={customQuote}
            onChangeText={setCustomQuote}
            placeholder="Add your own quote…"
            style={styles.customInput}
            onSubmitEditing={addQuote}
            returnKeyType="done"
          />
          <PrimaryButton label="Add" onPress={addQuote} disabled={!customQuote.trim()} />
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText type="defaultSemiBold">Known failure modes</ThemedText>
        <ThemedText type="caption">
          What usually derails this goal? A pattern can belong to several goals.
        </ThemedText>
        {PRESETS.map((preset) => {
          const existing = failurePoints.find(
            (fp) => fp.isPreset && fp.label === preset.failurePoint.label
          );
          const checked = existing ? value.failurePointIds.includes(existing.id) : false;
          return checkRow(preset.failurePoint.label, preset.failurePoint.label, checked, () =>
            togglePreset(preset)
          );
        })}
        {failurePoints
          .filter((fp) => !fp.isPreset)
          .map((fp) =>
            checkRow(fp.id, fp.label, value.failurePointIds.includes(fp.id), () =>
              onChange({ ...value, failurePointIds: toggleId(value.failurePointIds, fp.id) })
            )
          )}
        <View style={styles.customRow}>
          <ThemedTextInput
            value={customPattern}
            onChangeText={setCustomPattern}
            placeholder="Add your own pattern…"
            style={styles.customInput}
            onSubmitEditing={addPattern}
            returnKeyType="done"
          />
          <PrimaryButton label="Add" onPress={addPattern} disabled={!customPattern.trim()} />
        </View>
      </View>
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
  section: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + Spacing.xs,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
  },
  rowLabel: {
    flex: 1,
  },
  customRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  customInput: {
    flex: 1,
  },
});
