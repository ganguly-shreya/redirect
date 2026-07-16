import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GoalEditor,
  createEmptyGoalDraft,
  isGoalDraftValid,
  type GoalDraft,
} from '@/components/goal-editor';
import { PlanForm, isPlanFormValueValid } from '@/components/plan-form';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimePickerRow } from '@/components/time-picker-row';
import { Radius, Spacing } from '@/constants/theme';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { useThemeColor } from '@/hooks/use-theme-color';
import { createId } from '@/lib/id';
import { BUNDLED_VISION_IMAGES, persistPickedImage } from '@/lib/images';
import { requestNotificationPermissions, rescheduleAllNotifications } from '@/lib/notifications';
import {
  PRESET_QUOTES,
  instantiatePreset,
  instantiateQuote,
  type PresetDefinition,
} from '@/lib/presets';
import { setItem } from '@/lib/storage';
import type {
  CheckInTime,
  FailurePoint,
  Goal,
  IfThenPlan,
  Quote,
  VisionBoardImage,
} from '@/types/models';

type PatternSelection = { failurePoint: FailurePoint; plan: IfThenPlan };

const STEP_TITLES = [
  'What are you working toward?',
  'Make a plan for each pattern',
  'Daily check-ins',
  'Your daily recap',
] as const;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const icon = useThemeColor({}, 'icon');
  const danger = useThemeColor({}, 'danger');
  const { completeOnboarding } = useOnboardingStatus();

  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<Goal[]>([]);
  // null = no editor open; id null inside = adding a new goal.
  const [goalDraft, setGoalDraft] = useState<{ id: string | null; draft: GoalDraft } | null>(null);
  // Every instantiated pattern (with its plan); a pattern only survives finish()
  // if at least one goal links it.
  const [patterns, setPatterns] = useState<PatternSelection[]>([]);
  // Shared pools goals select from. Bundled defaults and preset quotes start in
  // the pool; user picks/additions grow it.
  const [imagePool, setImagePool] = useState<VisionBoardImage[]>([...BUNDLED_VISION_IMAGES]);
  const [quotePool, setQuotePool] = useState<Quote[]>(() =>
    PRESET_QUOTES.map((text) => instantiateQuote(text, true))
  );
  const [times, setTimes] = useState<CheckInTime[]>([{ hour: 14, minute: 0 }]);
  const [recapTime, setRecapTime] = useState<CheckInTime>({ hour: 21, minute: 0 });

  const linkedPatterns = patterns.filter((s) => s.failurePoint.goalIds.length > 0);

  const instantiatePresetPattern = (preset: PresetDefinition): string => {
    const selection = instantiatePreset(preset);
    setPatterns((prev) => [...prev, selection]);
    return selection.failurePoint.id;
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
    setPatterns((prev) => [...prev, { failurePoint, plan }]);
    return failurePoint.id;
  };

  const pickImages = async (): Promise<VisionBoardImage[]> => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (result.canceled) return [];
    const persisted = result.assets.map(persistPickedImage);
    setImagePool((prev) => [...prev, ...persisted]);
    return persisted;
  };

  const addQuote = (text: string): Quote => {
    const quote = instantiateQuote(text, false);
    setQuotePool((prev) => [...prev, quote]);
    return quote;
  };

  const startEditGoal = (goal: Goal) =>
    setGoalDraft({
      id: goal.id,
      draft: {
        title: goal.title,
        why: goal.why,
        targetDate: goal.targetDate,
        imageIds: [...goal.imageIds],
        quoteIds: [...goal.quoteIds],
        failurePointIds: patterns
          .filter((s) => s.failurePoint.goalIds.includes(goal.id))
          .map((s) => s.failurePoint.id),
      },
    });

  const saveGoalDraft = () => {
    if (!goalDraft || !isGoalDraftValid(goalDraft.draft)) return;
    const { draft } = goalDraft;
    const id = goalDraft.id ?? createId();
    const existing = goals.find((g) => g.id === goalDraft.id);
    const goal: Goal = {
      id,
      title: draft.title.trim(),
      why: draft.why.trim(),
      targetDate: draft.targetDate,
      imageIds: draft.imageIds,
      quoteIds: draft.quoteIds,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    setGoals((prev) =>
      existing ? prev.map((g) => (g.id === id ? goal : g)) : [...prev, goal]
    );
    // Sync the many-to-many side: each pattern's goalIds gains/loses this goal.
    setPatterns((prev) =>
      prev.map((s) => {
        const linked = draft.failurePointIds.includes(s.failurePoint.id);
        const has = s.failurePoint.goalIds.includes(id);
        if (linked === has) return s;
        return {
          ...s,
          failurePoint: {
            ...s.failurePoint,
            goalIds: linked
              ? [...s.failurePoint.goalIds, id]
              : s.failurePoint.goalIds.filter((g) => g !== id),
          },
        };
      })
    );
    setGoalDraft(null);
  };

  const removeGoal = (goal: Goal) => {
    setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    setPatterns((prev) =>
      prev.map((s) =>
        s.failurePoint.goalIds.includes(goal.id)
          ? {
              ...s,
              failurePoint: {
                ...s.failurePoint,
                goalIds: s.failurePoint.goalIds.filter((g) => g !== goal.id),
              },
            }
          : s
      )
    );
  };

  const updatePlan = (failurePointId: string, plan: IfThenPlan) =>
    setPatterns((prev) =>
      prev.map((s) => (s.failurePoint.id === failurePointId ? { ...s, plan } : s))
    );

  const finish = async () => {
    // Patterns no goal links (created then unlinked mid-flow) are dropped.
    await setItem('goals', goals);
    await setItem('quotes', quotePool);
    await setItem('failurePoints', linkedPatterns.map((s) => s.failurePoint));
    await setItem('plans', linkedPatterns.map((s) => s.plan));
    await setItem('visionBoardImages', imagePool);
    await setItem('checkInTimes', times);
    await setItem('recapTime', recapTime);
    // Schedule even if permission is denied: the schedule is harmless without
    // display permission, and starts working if the user later grants it in
    // system settings.
    await requestNotificationPermissions();
    await rescheduleAllNotifications({
      checkInTimes: times,
      recapTime,
      todayRedirectCount: 0,
    });
    await completeOnboarding();
  };

  const canContinue =
    step === 0
      ? goals.length > 0 && goalDraft === null && linkedPatterns.length > 0
      : step === 1
        ? linkedPatterns.every((s) => isPlanFormValueValid(s.plan))
        : true;

  const renderGoalDraftCard = () => {
    if (!goalDraft) return null;
    return (
      <View style={[styles.goalCard, { backgroundColor: card, borderColor: border }]}>
        <GoalEditor
          value={goalDraft.draft}
          onChange={(draft) => setGoalDraft({ ...goalDraft, draft })}
          images={imagePool}
          onPickImages={pickImages}
          quotes={quotePool}
          onAddQuote={addQuote}
          failurePoints={patterns.map((s) => s.failurePoint)}
          onInstantiatePreset={instantiatePresetPattern}
          onAddCustomPattern={addCustomPattern}
        />
        <View style={styles.draftButtons}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setGoalDraft(null)}
            style={styles.cancel}>
            <ThemedText type="link">Cancel</ThemedText>
          </Pressable>
          <PrimaryButton
            label="Save goal"
            onPress={saveGoalDraft}
            disabled={!isGoalDraftValid(goalDraft.draft)}
            style={styles.save}
          />
        </View>
      </View>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepBody}>
            <ThemedText type="caption">
              Start with the goals that matter. Each one gets a why, a vision board, and the
              failure patterns that usually derail it.
            </ThemedText>
            {goals.map((goal) => {
              if (goalDraft && goalDraft.id === goal.id) {
                return <View key={goal.id}>{renderGoalDraftCard()}</View>;
              }
              const patternLabels = patterns
                .filter((s) => s.failurePoint.goalIds.includes(goal.id))
                .map((s) => s.failurePoint.label);
              return (
                <View
                  key={goal.id}
                  style={[styles.goalCard, { backgroundColor: card, borderColor: border }]}>
                  <View style={styles.goalHeader}>
                    <ThemedText type="defaultSemiBold" style={styles.goalTitle}>
                      {goal.title}
                    </ThemedText>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Edit goal"
                      hitSlop={8}
                      onPress={() => startEditGoal(goal)}>
                      <Ionicons name="pencil-outline" size={18} color={icon} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete goal"
                      hitSlop={8}
                      onPress={() => removeGoal(goal)}>
                      <Ionicons name="trash-outline" size={18} color={danger} />
                    </Pressable>
                  </View>
                  <ThemedText type="caption">{goal.why}</ThemedText>
                  <ThemedText type="caption">
                    By {format(parseISO(goal.targetDate), 'MMM d, yyyy')} ·{' '}
                    {goal.imageIds.length} images · {goal.quoteIds.length} quotes
                  </ThemedText>
                  <ThemedText type="caption">
                    {patternLabels.length > 0
                      ? `Failure modes: ${patternLabels.join(', ')}`
                      : 'No failure modes linked yet — edit to add some.'}
                  </ThemedText>
                </View>
              );
            })}
            {goalDraft && goalDraft.id === null && renderGoalDraftCard()}
            {!goalDraft && (
              <PrimaryButton
                label={goals.length === 0 ? 'Add your first goal' : 'Add another goal'}
                onPress={() => setGoalDraft({ id: null, draft: createEmptyGoalDraft() })}
              />
            )}
          </View>
        );
      case 1:
        return (
          <View style={styles.stepBody}>
            <ThemedText type="caption">
              Each failure pattern gets an if-then plan. Accept the suggestion or tweak it.
            </ThemedText>
            {linkedPatterns.map((s) => (
              <View
                key={s.failurePoint.id}
                style={[styles.planCard, { backgroundColor: card, borderColor: border }]}>
                <ThemedText type="defaultSemiBold">{s.failurePoint.label}</ThemedText>
                <PlanForm
                  value={s.plan}
                  onChange={(value) => updatePlan(s.failurePoint.id, { ...s.plan, ...value })}
                />
              </View>
            ))}
          </View>
        );
      case 2:
        return (
          <View style={styles.stepBody}>
            <ThemedText type="caption">
              Redirect will nudge you at these times each day to ask if you&apos;re stuck. Pick 1 to
              3 times.
            </ThemedText>
            {times.map((time, index) => (
              <TimePickerRow
                key={index}
                time={time}
                onChange={(next) =>
                  setTimes((prev) => prev.map((t, i) => (i === index ? next : t)))
                }
                onRemove={
                  times.length > 1
                    ? () => setTimes((prev) => prev.filter((_, i) => i !== index))
                    : undefined
                }
              />
            ))}
            {times.length < 3 && (
              <PrimaryButton
                label="Add another time"
                onPress={() => setTimes((prev) => [...prev, { hour: 9, minute: 0 }])}
              />
            )}
          </View>
        );
      case 3:
        return (
          <View style={styles.stepBody}>
            <ThemedText type="caption">
              Once a day, Redirect recaps how many times you won at redirecting your brain. When
              should it arrive?
            </ThemedText>
            <TimePickerRow label="Daily recap" time={recapTime} onChange={setRecapTime} />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ThemedView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <ThemedText type="caption">Step {step + 1} of 4</ThemedText>
          <ThemedText type="title">{STEP_TITLES[step]}</ThemedText>
        </View>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {renderStep()}
        </ScrollView>
        <View style={styles.footer}>
          {step > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setStep(step - 1)}
              style={styles.backButton}>
              <ThemedText type="link">Back</ThemedText>
            </Pressable>
          )}
          <PrimaryButton
            label={step === 3 ? 'Finish' : 'Continue'}
            disabled={!canContinue}
            onPress={() => (step === 3 ? finish() : setStep(step + 1))}
            style={styles.continueButton}
          />
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screen,
    paddingBottom: Spacing.lg,
  },
  stepBody: {
    gap: Spacing.sm + Spacing.xs,
  },
  goalCard: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  goalTitle: {
    flex: 1,
  },
  planCard: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.md,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.md,
  },
  backButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  continueButton: {
    flex: 1,
  },
});
