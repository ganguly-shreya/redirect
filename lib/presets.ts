import { createId } from '@/lib/id';
import type { FailurePoint, IfThenPlan } from '@/types/models';

export type PresetDefinition = {
  failurePoint: Omit<FailurePoint, 'id'>;
  suggestedPlan: Pick<IfThenPlan, 'triggerDescription' | 'actionType' | 'actionConfig'>;
};

export const PRESETS: readonly PresetDefinition[] = [
  {
    failurePoint: { label: 'Phone scrolling during work', isPreset: true },
    suggestedPlan: {
      triggerDescription: 'If I catch myself scrolling my phone mid-deep-work…',
      actionType: 'timer',
      actionConfig: { durationMinutes: 10 },
    },
  },
  {
    failurePoint: { label: 'Perfectionist proofreading', isPreset: true },
    suggestedPlan: {
      triggerDescription: 'If I re-read the same paragraph for the third time…',
      actionType: 'customMessage',
      actionConfig: { message: 'Done beats perfect. Ship it now — fix it later if anyone notices.' },
    },
  },
  {
    failurePoint: { label: 'Motivation loss', isPreset: true },
    suggestedPlan: {
      triggerDescription: 'If I feel like none of this matters…',
      actionType: 'visionBoard',
      actionConfig: {},
    },
  },
  {
    failurePoint: { label: 'Task-switching', isPreset: true },
    suggestedPlan: {
      triggerDescription: 'If I start a new task before finishing the current one…',
      actionType: 'customMessage',
      actionConfig: { message: 'One thing at a time — go back to the task you left.' },
    },
  },
  {
    failurePoint: { label: 'Procrastination', isPreset: true },
    suggestedPlan: {
      triggerDescription: 'If I keep putting off starting…',
      actionType: 'timer',
      actionConfig: { durationMinutes: 5 },
    },
  },
];

// Presets are templates; ids are minted per user at selection time so a preset
// can be removed and re-added, or customized, without colliding with stored data.
export function instantiatePreset(preset: PresetDefinition): {
  failurePoint: FailurePoint;
  plan: IfThenPlan;
} {
  const failurePoint: FailurePoint = { id: createId(), ...preset.failurePoint };
  const plan: IfThenPlan = {
    id: createId(),
    failurePointId: failurePoint.id,
    ...preset.suggestedPlan,
    // Deep-copy the config so edits to an instantiated plan never mutate the template.
    actionConfig: { ...preset.suggestedPlan.actionConfig },
    createdAt: new Date().toISOString(),
  };
  return { failurePoint, plan };
}
