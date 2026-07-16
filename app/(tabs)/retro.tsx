import { format, isToday, parseISO, startOfWeek } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TriggerLogRow } from '@/components/trigger-log-row';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { computePlanStats, setTriggerOutcome } from '@/lib/plan-engine';
import { getCollection } from '@/lib/storage';
import type { FailurePoint, IfThenPlan, TriggerLog, TriggerOutcome } from '@/types/models';

export default function RetroScreen() {
  const [logs, setLogs] = useState<TriggerLog[]>([]);
  const [plans, setPlans] = useState<IfThenPlan[]>([]);
  const [failurePoints, setFailurePoints] = useState<FailurePoint[]>([]);

  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');

  useFocusEffect(
    useCallback(() => {
      getCollection('triggerLogs').then(setLogs);
      getCollection('plans').then(setPlans);
      getCollection('failurePoints').then(setFailurePoints);
    }, [])
  );

  const labelForPlan = (planId: string): string => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return '(deleted pattern)';
    return failurePoints.find((fp) => fp.id === plan.failurePointId)?.label ?? '(deleted pattern)';
  };

  const markOutcome = async (log: TriggerLog, outcome: TriggerOutcome) => {
    await setTriggerOutcome(log.id, outcome);
    setLogs((prev) => prev.map((l) => (l.id === log.id ? { ...l, outcome } : l)));
  };

  const stats = computePlanStats(logs, plans, failurePoints);

  // End-of-day recap, phrased about the user. A win = a redirect that actually
  // helped; untagged runs are prompted for, not celebrated. The recap
  // notification deep-links here.
  const todayLogs = logs.filter((log) => isToday(parseISO(log.firedAt)));
  const todayWins = todayLogs.filter((log) => log.outcome === 'helped').length;
  const todaySummary =
    todayLogs.length === 0
      ? null
      : todayWins > 0
        ? `You won ${todayWins === 1 ? 'once' : `${todayWins} times`} at redirecting your brain today. 🎉`
        : `You caught yourself ${
            todayLogs.length === 1 ? 'once' : `${todayLogs.length} times`
          } today. Tag the redirects that helped to count your wins.`;

  // Newest first, grouped by ISO week (Monday start).
  const sorted = [...logs].sort((a, b) => b.firedAt.localeCompare(a.firedAt));
  const weeks: { title: string; items: TriggerLog[] }[] = [];
  for (const log of sorted) {
    const weekStart = startOfWeek(parseISO(log.firedAt), { weekStartsOn: 1 });
    const title = format(weekStart, "'Week of' MMM d");
    const bucket = weeks.find((w) => w.title === title);
    if (bucket) {
      bucket.items.push(log);
    } else {
      weeks.push({ title, items: [log] });
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {todaySummary && (
          <View style={[styles.statsCard, { backgroundColor: card, borderColor: border }]}>
            <ThemedText type="defaultSemiBold">Today</ThemedText>
            <ThemedText>{todaySummary}</ThemedText>
          </View>
        )}
        {stats.length > 0 && (
          <View style={[styles.statsCard, { backgroundColor: card, borderColor: border }]}>
            <ThemedText type="defaultSemiBold">What&apos;s working</ThemedText>
            {stats.map((s) => (
              <View key={s.planId} style={styles.statRow}>
                <ThemedText style={styles.statLabel}>{s.label}</ThemedText>
                <ThemedText type="caption">
                  {s.helped} helped · {s.didNotHelp} didn&apos;t
                </ThemedText>
              </View>
            ))}
          </View>
        )}
        {weeks.map((week) => (
          <View key={week.title} style={styles.week}>
            <ThemedText type="subtitle">{week.title}</ThemedText>
            {week.items.map((log) => (
              <TriggerLogRow
                key={log.id}
                log={log}
                label={labelForPlan(log.planId)}
                onOutcome={(outcome) => markOutcome(log, outcome)}
              />
            ))}
          </View>
        ))}
        {logs.length === 0 && (
          <ThemedText type="caption">
            No redirects yet. When you tap &quot;I&apos;m Stuck&quot; and run a plan, it shows up
            here so you can track what actually helps.
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
    gap: Spacing.lg,
  },
  statsCard: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  statLabel: {
    flex: 1,
  },
  week: {
    gap: Spacing.sm + Spacing.xs,
  },
});
