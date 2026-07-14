import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlanForm, isPlanFormValueValid } from '@/components/plan-form';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/themed-text-input';
import { ThemedView } from '@/components/themed-view';
import { VisionImageGrid } from '@/components/vision-image-grid';
import { Radius, Spacing } from '@/constants/theme';
import { useOnboardingStatus } from '@/hooks/use-onboarding-status';
import { useThemeColor } from '@/hooks/use-theme-color';
import { createId } from '@/lib/id';
import { BUNDLED_VISION_IMAGES, persistPickedImage } from '@/lib/images';
import { PRESETS, instantiatePreset, type PresetDefinition } from '@/lib/presets';
import { setItem } from '@/lib/storage';
import type { FailurePoint, IfThenPlan, VisionBoardImage } from '@/types/models';

type Selection = { failurePoint: FailurePoint; plan: IfThenPlan };

const STEP_TITLES = [
  'Where do you get stuck?',
  'Make a plan for each',
  'Build your vision board',
  'Daily check-ins',
] as const;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const icon = useThemeColor({}, 'icon');
  const { completeOnboarding } = useOnboardingStatus();

  const [step, setStep] = useState(0);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [customLabel, setCustomLabel] = useState('');
  // Bundled defaults start selected; the user can remove any of them or add their own.
  const [images, setImages] = useState<VisionBoardImage[]>([...BUNDLED_VISION_IMAGES]);

  const togglePreset = (preset: PresetDefinition) => {
    setSelections((prev) => {
      const index = prev.findIndex(
        (s) => s.failurePoint.isPreset && s.failurePoint.label === preset.failurePoint.label
      );
      if (index >= 0) return prev.filter((_, i) => i !== index);
      return [...prev, instantiatePreset(preset)];
    });
  };

  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) return;
    const failurePoint: FailurePoint = { id: createId(), label, isPreset: false };
    const plan: IfThenPlan = {
      id: createId(),
      failurePointId: failurePoint.id,
      triggerDescription: '',
      actionType: 'customMessage',
      actionConfig: {},
      createdAt: new Date().toISOString(),
    };
    setSelections((prev) => [...prev, { failurePoint, plan }]);
    setCustomLabel('');
  };

  const removeSelection = (failurePointId: string) =>
    setSelections((prev) => prev.filter((s) => s.failurePoint.id !== failurePointId));

  const updatePlan = (failurePointId: string, plan: IfThenPlan) =>
    setSelections((prev) =>
      prev.map((s) => (s.failurePoint.id === failurePointId ? { ...s, plan } : s))
    );

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (result.canceled) return;
    setImages((prev) => [...prev, ...result.assets.map(persistPickedImage)]);
  };

  // Finish grows in step 5 (times) and step 8 (notifications).
  const finish = async () => {
    await setItem('failurePoints', selections.map((s) => s.failurePoint));
    await setItem('plans', selections.map((s) => s.plan));
    await setItem('visionBoardImages', images);
    await completeOnboarding();
  };

  const canContinue =
    step === 0
      ? selections.length > 0
      : step === 1
        ? selections.every((s) => isPlanFormValueValid(s.plan))
        : step === 2
          ? images.length >= 3
          : true;

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepBody}>
            <ThemedText type="caption">
              Pick the patterns that derail you, or add your own.
            </ThemedText>
            {PRESETS.map((preset) => {
              const selected = selections.some(
                (s) => s.failurePoint.isPreset && s.failurePoint.label === preset.failurePoint.label
              );
              return (
                <Pressable
                  key={preset.failurePoint.label}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  onPress={() => togglePreset(preset)}
                  style={[
                    styles.row,
                    { backgroundColor: card, borderColor: selected ? tint : border },
                  ]}>
                  <Ionicons
                    name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={selected ? tint : icon}
                  />
                  <ThemedText style={styles.rowLabel}>{preset.failurePoint.label}</ThemedText>
                </Pressable>
              );
            })}
            {selections
              .filter((s) => !s.failurePoint.isPreset)
              .map((s) => (
                <Pressable
                  key={s.failurePoint.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: true }}
                  onPress={() => removeSelection(s.failurePoint.id)}
                  style={[styles.row, { backgroundColor: card, borderColor: tint }]}>
                  <Ionicons name="checkmark-circle" size={22} color={tint} />
                  <ThemedText style={styles.rowLabel}>{s.failurePoint.label}</ThemedText>
                  <Ionicons name="close" size={18} color={icon} />
                </Pressable>
              ))}
            <View style={styles.customRow}>
              <ThemedTextInput
                value={customLabel}
                onChangeText={setCustomLabel}
                placeholder="Add your own pattern…"
                style={styles.customInput}
                onSubmitEditing={addCustom}
                returnKeyType="done"
              />
              <PrimaryButton label="Add" onPress={addCustom} disabled={!customLabel.trim()} />
            </View>
          </View>
        );
      case 1:
        return (
          <View style={styles.stepBody}>
            <ThemedText type="caption">
              Each pattern gets an if-then plan. Accept the suggestion or tweak it.
            </ThemedText>
            {selections.map((s) => (
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
              When a plan redirects you here, one of these images is shown full-screen. We added
              some to start — remove any, or add your own. Keep at least 3.
            </ThemedText>
            <VisionImageGrid
              images={images}
              onRemove={(image) => setImages((prev) => prev.filter((i) => i.id !== image.id))}
            />
            <PrimaryButton label="Add your own" onPress={pickImages} />
          </View>
        );
      case 3:
        return (
          <View style={styles.stepBody}>
            <ThemedText type="caption">Check-in times land in step 5 of the build.</ThemedText>
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
  planCard: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.md,
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
