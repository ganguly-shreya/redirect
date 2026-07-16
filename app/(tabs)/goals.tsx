import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  GoalEditor,
  createEmptyGoalDraft,
  isGoalDraftValid,
  type GoalDraft,
} from '@/components/goal-editor';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { createId } from '@/lib/id';
import { persistPickedImage } from '@/lib/images';
import {
  PRESET_QUOTES,
  instantiatePreset,
  instantiateQuote,
  type PresetDefinition,
} from '@/lib/presets';
import {
  getCollection,
  removeFromCollection,
  setItem,
  upsertInCollection,
} from '@/lib/storage';
import type {
  FailurePoint,
  Goal,
  IfThenPlan,
  Quote,
  VisionBoardImage,
} from '@/types/models';

type PendingPattern = { failurePoint: FailurePoint; plan: IfThenPlan };

// Goals own the vision content: images, quotes, and which failure patterns
// derail them. Replaces the V1 Vision Board tab — images/quotes are managed
// per goal here.
export default function GoalsScreen() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [images, setImages] = useState<VisionBoardImage[]>([]);
  const [failurePoints, setFailurePoints] = useState<FailurePoint[]>([]);
  // Patterns created inside an open draft; persisted only if the draft is saved
  // with them still linked (so Cancel leaves storage untouched).
  const [pendingPatterns, setPendingPatterns] = useState<PendingPattern[]>([]);
  const [draft, setDraft] = useState<{ id: string | null; value: GoalDraft } | null>(null);

  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const icon = useThemeColor({}, 'icon');
  const danger = useThemeColor({}, 'danger');

  const reload = useCallback(() => {
    getCollection('goals').then(setGoals);
    getCollection('failurePoints').then(setFailurePoints);
    getCollection('visionBoardImages').then(setImages);
    getCollection('quotes').then(async (stored) => {
      // Pre-V2 installs have no quotes yet — seed the preset pool once so the
      // editor has something to offer (same set onboarding writes).
      if (stored.length === 0) {
        const seeded = PRESET_QUOTES.map((text) => instantiateQuote(text, true));
        await setItem('quotes', seeded);
        setQuotes(seeded);
      } else {
        setQuotes(stored);
      }
    });
  }, []);

  useFocusEffect(reload);

  const allPatterns = [...failurePoints, ...pendingPatterns.map((p) => p.failurePoint)];

  const pickImages = async (): Promise<VisionBoardImage[]> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (result.canceled) return [];
    const persisted = result.assets.map(persistPickedImage);
    const next = [...images, ...persisted];
    await setItem('visionBoardImages', next);
    setImages(next);
    return persisted;
  };

  const addQuote = (text: string): Quote => {
    const quote = instantiateQuote(text, false);
    upsertInCollection('quotes', quote);
    setQuotes((prev) => [...prev, quote]);
    return quote;
  };

  const instantiatePresetPattern = (preset: PresetDefinition): string => {
    const pending = instantiatePreset(preset);
    setPendingPatterns((prev) => [...prev, pending]);
    return pending.failurePoint.id;
  };

  const addCustomPattern = (label: string): string => {
    const failurePoint: FailurePoint = { id: createId(), label, isPreset: false, goalIds: [] };
    const plan: IfThenPlan = {
      id: createId(),
      failurePointId: failurePoint.id,
      triggerDescription: '',
      actionType: 'customMessage',
      actionConfig: {},
      createdAt: new Date().toISOString(),
    };
    setPendingPatterns((prev) => [...prev, { failurePoint, plan }]);
    return failurePoint.id;
  };

  const startEdit = (goal: Goal) =>
    setDraft({
      id: goal.id,
      value: {
        title: goal.title,
        why: goal.why,
        targetDate: goal.targetDate,
        imageIds: [...goal.imageIds],
        quoteIds: [...goal.quoteIds],
        failurePointIds: failurePoints
          .filter((fp) => fp.goalIds.includes(goal.id))
          .map((fp) => fp.id),
      },
    });

  const closeDraft = () => {
    setDraft(null);
    setPendingPatterns([]);
  };

  const saveDraft = async () => {
    if (!draft || !isGoalDraftValid(draft.value)) return;
    const { value } = draft;
    const id = draft.id ?? createId();
    const existing = goals.find((g) => g.id === draft.id);

    // Unlinking this goal may leave a stored pattern with no goals at all —
    // the invariant says that can't stand, so those patterns (and their plans)
    // go with it, after confirmation.
    const orphans = failurePoints.filter(
      (fp) =>
        fp.goalIds.includes(id) &&
        !value.failurePointIds.includes(fp.id) &&
        fp.goalIds.every((g) => g === id)
    );
    if (orphans.length > 0) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Remove unlinked patterns?',
          `${orphans.map((fp) => `"${fp.label}"`).join(', ')} would no longer belong to any goal, so the pattern and its plan will be deleted.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Remove', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      });
      if (!proceed) return;
    }

    const goal: Goal = {
      id,
      title: value.title.trim(),
      why: value.why.trim(),
      targetDate: value.targetDate,
      imageIds: value.imageIds,
      quoteIds: value.quoteIds,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    await upsertInCollection('goals', goal);

    // Sync goalIds on stored patterns (link/unlink this goal).
    for (const fp of failurePoints) {
      const linked = value.failurePointIds.includes(fp.id);
      const has = fp.goalIds.includes(id);
      if (linked === has) continue;
      await upsertInCollection('failurePoints', {
        ...fp,
        goalIds: linked ? [...fp.goalIds, id] : fp.goalIds.filter((g) => g !== id),
      });
    }
    for (const orphan of orphans) {
      const plans = await getCollection('plans');
      const plan = plans.find((p) => p.failurePointId === orphan.id);
      if (plan) await removeFromCollection('plans', plan.id);
      await removeFromCollection('failurePoints', orphan.id);
    }
    // Persist draft-created patterns that ended up linked; drop the rest.
    for (const pending of pendingPatterns) {
      if (!value.failurePointIds.includes(pending.failurePoint.id)) continue;
      await upsertInCollection('failurePoints', {
        ...pending.failurePoint,
        goalIds: [id],
      });
      await upsertInCollection('plans', pending.plan);
    }

    closeDraft();
    reload();
  };

  const confirmDelete = (goal: Goal) => {
    // Blocked when deletion would orphan a pattern: every pattern must keep at
    // least one goal. TriggerLogs and pool images/quotes are untouched.
    const wouldOrphan = failurePoints.filter(
      (fp) => fp.goalIds.includes(goal.id) && fp.goalIds.every((g) => g === goal.id)
    );
    if (wouldOrphan.length > 0) {
      Alert.alert(
        'This goal still has patterns',
        `${wouldOrphan.map((fp) => `"${fp.label}"`).join(', ')} ${
          wouldOrphan.length === 1 ? 'is' : 'are'
        } only linked to this goal. Relink or delete ${
          wouldOrphan.length === 1 ? 'that pattern' : 'those patterns'
        } first (Plans tab).`,
        [{ text: 'OK' }]
      );
      return;
    }
    Alert.alert('Delete goal?', `"${goal.title}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeFromCollection('goals', goal.id);
          for (const fp of failurePoints) {
            if (!fp.goalIds.includes(goal.id)) continue;
            await upsertInCollection('failurePoints', {
              ...fp,
              goalIds: fp.goalIds.filter((g) => g !== goal.id),
            });
          }
          reload();
        },
      },
    ]);
  };

  const renderDraftCard = () => {
    if (!draft) return null;
    return (
      <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
        <GoalEditor
          value={draft.value}
          onChange={(value) => setDraft({ ...draft, value })}
          images={images}
          onPickImages={pickImages}
          quotes={quotes}
          onAddQuote={addQuote}
          failurePoints={allPatterns}
          onInstantiatePreset={instantiatePresetPattern}
          onAddCustomPattern={addCustomPattern}
        />
        <View style={styles.draftButtons}>
          <Pressable accessibilityRole="button" onPress={closeDraft} style={styles.cancel}>
            <ThemedText type="link">Cancel</ThemedText>
          </Pressable>
          <PrimaryButton
            label="Save goal"
            onPress={saveDraft}
            disabled={!isGoalDraftValid(draft.value)}
            style={styles.save}
          />
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {goals.map((goal) => {
          if (draft && draft.id === goal.id) {
            return <View key={goal.id}>{renderDraftCard()}</View>;
          }
          const patternLabels = failurePoints
            .filter((fp) => fp.goalIds.includes(goal.id))
            .map((fp) => fp.label);
          return (
            <View
              key={goal.id}
              style={[styles.card, { backgroundColor: card, borderColor: border }]}>
              <View style={styles.cardHeader}>
                <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                  {goal.title}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit goal"
                  hitSlop={8}
                  onPress={() => startEdit(goal)}>
                  <Ionicons name="pencil-outline" size={18} color={icon} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete goal"
                  hitSlop={8}
                  onPress={() => confirmDelete(goal)}>
                  <Ionicons name="trash-outline" size={18} color={danger} />
                </Pressable>
              </View>
              <ThemedText type="caption">{goal.why}</ThemedText>
              <ThemedText type="caption">
                By {format(parseISO(goal.targetDate), 'MMM d, yyyy')} · {goal.imageIds.length}{' '}
                images · {goal.quoteIds.length} quotes
              </ThemedText>
              <ThemedText type="caption">
                {patternLabels.length > 0
                  ? `Failure modes: ${patternLabels.join(', ')}`
                  : 'No failure modes linked yet.'}
              </ThemedText>
            </View>
          );
        })}
        {draft && draft.id === null && renderDraftCard()}
        {!draft && (
          <PrimaryButton
            label="Add goal"
            onPress={() => setDraft({ id: null, value: createEmptyGoalDraft() })}
          />
        )}
        {goals.length === 0 && !draft && (
          <ThemedText type="caption">
            No goals yet. Add one — your vision board images, quotes, and failure patterns all
            hang off your goals.
          </ThemedText>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.screen,
    gap: Spacing.md,
  },
  card: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardTitle: {
    flex: 1,
  },
  draftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  cancel: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  save: {
    flex: 1,
  },
});
