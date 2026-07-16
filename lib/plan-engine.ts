import { createId } from '@/lib/id';
import { getCollection, upsertInCollection } from '@/lib/storage';
import type {
  FailurePoint,
  Goal,
  IfThenPlan,
  Quote,
  TriggerLog,
  TriggerOutcome,
  TriggerSource,
  VisionBoardImage,
} from '@/types/models';

// The single place a TriggerLog is created. Manual taps and (future) automatic
// detection should both funnel through here so Retro sees every execution.
export async function logTriggerFired(planId: string, source: TriggerSource): Promise<TriggerLog> {
  const log: TriggerLog = {
    id: createId(),
    planId,
    firedAt: new Date().toISOString(),
    source,
    outcome: null,
  };
  await upsertInCollection('triggerLogs', log);
  return log;
}

export async function setTriggerOutcome(logId: string, outcome: TriggerOutcome): Promise<void> {
  const logs = await getCollection('triggerLogs');
  const log = logs.find((l) => l.id === logId);
  if (!log) return;
  await upsertInCollection('triggerLogs', { ...log, outcome });
}

export function pickRandomVisionImage(images: VisionBoardImage[]): VisionBoardImage | null {
  if (images.length === 0) return null;
  return images[Math.floor(Math.random() * images.length)] ?? null;
}

// What the redirect screen shows when a failure pattern fires: a random image
// or quote from the pattern's connected goals (so both rotate across runs),
// always paired with the owning goal so its title + why can be displayed.
export type GoalRedirectContent =
  | { kind: 'image'; goal: Goal; image: VisionBoardImage }
  | { kind: 'quote'; goal: Goal; quote: Quote }
  // Connected goals exist but have no images/quotes — show the goal itself.
  | { kind: 'goal'; goal: Goal };

// Returns null only when the pattern has no connected goals, which onboarding
// and the Plans tab prevent — reachable only for un-edited pre-V2 patterns.
export function pickGoalRedirectContent(
  failurePoint: FailurePoint,
  goals: Goal[],
  images: VisionBoardImage[],
  quotes: Quote[]
): GoalRedirectContent | null {
  const linkedIds = failurePoint.goalIds ?? [];
  const linked = goals.filter((goal) => linkedIds.includes(goal.id));
  if (linked.length === 0) return null;

  const pool: GoalRedirectContent[] = [];
  for (const goal of linked) {
    for (const imageId of goal.imageIds) {
      const image = images.find((i) => i.id === imageId);
      if (image) pool.push({ kind: 'image', goal, image });
    }
    for (const quoteId of goal.quoteIds) {
      const quote = quotes.find((q) => q.id === quoteId);
      if (quote) pool.push({ kind: 'quote', goal, quote });
    }
  }
  if (pool.length === 0) {
    return { kind: 'goal', goal: linked[Math.floor(Math.random() * linked.length)]! };
  }
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export type PlanStats = {
  planId: string;
  label: string;
  helped: number;
  didNotHelp: number;
};

// Ratio header for Retro: one row per plan that has at least one rated log.
export function computePlanStats(
  logs: TriggerLog[],
  plans: IfThenPlan[],
  failurePoints: FailurePoint[]
): PlanStats[] {
  return plans
    .map((plan) => {
      const planLogs = logs.filter((log) => log.planId === plan.id);
      return {
        planId: plan.id,
        label:
          failurePoints.find((fp) => fp.id === plan.failurePointId)?.label ?? '(deleted pattern)',
        helped: planLogs.filter((log) => log.outcome === 'helped').length,
        didNotHelp: planLogs.filter((log) => log.outcome === 'didNotHelp').length,
      };
    })
    .filter((stats) => stats.helped + stats.didNotHelp > 0);
}
