import { createId } from '@/lib/id';
import { getCollection, upsertInCollection } from '@/lib/storage';
import type {
  FailurePoint,
  IfThenPlan,
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
