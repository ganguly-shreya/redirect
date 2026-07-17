import { createId } from '@/lib/id';
import type { FailurePoint, IfThenPlan, Quote } from '@/types/models';

export type PresetDefinition = {
  failurePoint: Omit<FailurePoint, 'id' | 'goalIds'>;
  suggestedPlan: Pick<IfThenPlan, 'triggerDescription' | 'actionType' | 'actionConfig'>;
};

export const PRESETS: readonly PresetDefinition[] = [
  {
    failurePoint: { label: 'Phone scrolling during work', isPreset: true },
    suggestedPlan: {
      triggerDescription: 'If I catch myself scrolling my phone mid-deep-work…',
      actionType: 'timer',
      actionConfig: {
        durationMinutes: 60,
        message: 'Phone face-down until the timer ends — the feed can wait.',
      },
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
      actionConfig: {
        durationMinutes: 5,
        message: 'Start with the smallest task when the timer finishes.',
      },
    },
  },
];

// Quote texts offered during goal setup; like image bundling, ids are minted
// per user at selection time (instantiateQuote) so stored quotes are plain data.
export const PRESET_QUOTES: readonly string[] = [
  'Done beats perfect.',
  'Discipline is choosing between what you want now and what you want most.',
  "You don't have to be great to start, but you have to start to be great.",
  "A year from now you'll wish you had started today.",
  'Progress over perfection.',
  'The best time to plant a tree was 20 years ago. The second best time is now.',
  'Small steps every day.',
  'Future you is watching.',
];

export function instantiateQuote(text: string, isPreset: boolean): Quote {
  return { id: createId(), text, isPreset };
}

// Presets are templates; ids are minted per user at selection time so a preset
// can be removed and re-added, or customized, without colliding with stored data.
export function instantiatePreset(
  preset: PresetDefinition,
  goalIds: string[] = []
): {
  failurePoint: FailurePoint;
  plan: IfThenPlan;
} {
  const failurePoint: FailurePoint = { id: createId(), goalIds: [...goalIds], ...preset.failurePoint };
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
