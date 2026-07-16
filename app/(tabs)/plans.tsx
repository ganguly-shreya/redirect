import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PlanForm, isPlanFormValueValid, type PlanFormValue } from '@/components/plan-form';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { createId } from '@/lib/id';
import { getCollection, removeFromCollection, upsertInCollection } from '@/lib/storage';
import type { FailurePoint, IfThenPlan } from '@/types/models';

const EMPTY_FORM: PlanFormValue = {
  triggerDescription: '',
  actionType: 'customMessage',
  actionConfig: {},
};

// One editable draft at a time (either editing an existing pattern or adding a
// new one) keeps the state simple and avoids concurrent-edit merge questions.
type Draft = {
  failurePointId: string | null; // null = adding new
  label: string;
  form: PlanFormValue;
};

export default function PlansScreen() {
  const [failurePoints, setFailurePoints] = useState<FailurePoint[]>([]);
  const [plans, setPlans] = useState<IfThenPlan[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);

  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const icon = useThemeColor({}, 'icon');
  const danger = useThemeColor({}, 'danger');

  const reload = useCallback(() => {
    getCollection('failurePoints').then(setFailurePoints);
    getCollection('plans').then(setPlans);
  }, []);

  useFocusEffect(reload);

  const startEdit = (failurePoint: FailurePoint, plan: IfThenPlan | undefined) =>
    setDraft({
      failurePointId: failurePoint.id,
      label: failurePoint.label,
      form: plan
        ? {
            triggerDescription: plan.triggerDescription,
            actionType: plan.actionType,
            actionConfig: { ...plan.actionConfig },
          }
        : EMPTY_FORM,
    });

  const saveDraft = async () => {
    if (!draft) return;
    const label = draft.label.trim();
    if (!label || !isPlanFormValueValid(draft.form)) return;

    if (draft.failurePointId === null) {
      const failurePoint: FailurePoint = { id: createId(), label, isPreset: false, goalIds: [] };
      const plan: IfThenPlan = {
        id: createId(),
        failurePointId: failurePoint.id,
        ...draft.form,
        createdAt: new Date().toISOString(),
      };
      await upsertInCollection('failurePoints', failurePoint);
      await upsertInCollection('plans', plan);
    } else {
      const failurePoint = failurePoints.find((fp) => fp.id === draft.failurePointId);
      const plan = plans.find((p) => p.failurePointId === draft.failurePointId);
      if (!failurePoint) return;
      await upsertInCollection('failurePoints', { ...failurePoint, label });
      await upsertInCollection(
        'plans',
        plan
          ? { ...plan, ...draft.form }
          : {
              id: createId(),
              failurePointId: failurePoint.id,
              ...draft.form,
              createdAt: new Date().toISOString(),
            }
      );
    }
    setDraft(null);
    reload();
  };

  const confirmDelete = (failurePoint: FailurePoint, plan: IfThenPlan | undefined) => {
    // TriggerLogs are intentionally kept — Retro shows a "(deleted pattern)" fallback.
    Alert.alert('Delete pattern?', `"${failurePoint.label}" and its plan will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (plan) await removeFromCollection('plans', plan.id);
          await removeFromCollection('failurePoints', failurePoint.id);
          reload();
        },
      },
    ]);
  };

  const renderDraftCard = () => {
    if (!draft) return null;
    return (
      <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
        <View style={styles.field}>
          <ThemedText type="caption">Pattern</ThemedText>
          <ThemedTextInput
            value={draft.label}
            onChangeText={(label) => setDraft({ ...draft, label })}
            placeholder="e.g. Doomscrolling after lunch"
          />
        </View>
        <PlanForm value={draft.form} onChange={(form) => setDraft({ ...draft, form })} />
        <View style={styles.draftButtons}>
          <Pressable accessibilityRole="button" onPress={() => setDraft(null)} style={styles.cancel}>
            <ThemedText type="link">Cancel</ThemedText>
          </Pressable>
          <PrimaryButton
            label="Save"
            onPress={saveDraft}
            disabled={!draft.label.trim() || !isPlanFormValueValid(draft.form)}
            style={styles.save}
          />
        </View>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {failurePoints.map((failurePoint) => {
          const plan = plans.find((p) => p.failurePointId === failurePoint.id);
          if (draft && draft.failurePointId === failurePoint.id) {
            return <View key={failurePoint.id}>{renderDraftCard()}</View>;
          }
          return (
            <View
              key={failurePoint.id}
              style={[styles.card, { backgroundColor: card, borderColor: border }]}>
              <View style={styles.cardHeader}>
                <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                  {failurePoint.label}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit"
                  hitSlop={8}
                  onPress={() => startEdit(failurePoint, plan)}>
                  <Ionicons name="pencil-outline" size={18} color={icon} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete"
                  hitSlop={8}
                  onPress={() => confirmDelete(failurePoint, plan)}>
                  <Ionicons name="trash-outline" size={18} color={danger} />
                </Pressable>
              </View>
              {plan ? (
                <>
                  <ThemedText type="caption">{plan.triggerDescription}</ThemedText>
                  <ThemedText type="caption">
                    Then:{' '}
                    {plan.actionType === 'timer'
                      ? `${plan.actionConfig.durationMinutes ?? '?'} min timer`
                      : plan.actionType === 'visionBoard'
                        ? 'vision board'
                        : `"${plan.actionConfig.message ?? ''}"`}
                  </ThemedText>
                </>
              ) : (
                <ThemedText type="caption">No plan yet — tap edit to add one.</ThemedText>
              )}
            </View>
          );
        })}
        {draft && draft.failurePointId === null && renderDraftCard()}
        {!draft && (
          <PrimaryButton
            label="Add pattern"
            onPress={() => setDraft({ failurePointId: null, label: '', form: EMPTY_FORM })}
          />
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
  field: {
    gap: Spacing.xs,
  },
  draftButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cancel: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  save: {
    flex: 1,
  },
});
