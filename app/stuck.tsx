import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getCollection } from '@/lib/storage';
import type { FailurePoint, IfThenPlan } from '@/types/models';

// Plan picker. Reached from the Home button (source undefined -> 'manual') or a
// check-in notification tap (source 'scheduled'); the source is forwarded to the
// execute screen so TriggerLogs record how the redirect started.
export default function StuckScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const [failurePoints, setFailurePoints] = useState<FailurePoint[]>([]);
  const [plans, setPlans] = useState<IfThenPlan[]>([]);

  useEffect(() => {
    getCollection('failurePoints').then(setFailurePoints);
    getCollection('plans').then(setPlans);
  }, []);

  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const icon = useThemeColor({}, 'icon');

  const rows = failurePoints
    .map((failurePoint) => ({
      failurePoint,
      plan: plans.find((p) => p.failurePointId === failurePoint.id),
    }))
    .filter((row): row is { failurePoint: FailurePoint; plan: IfThenPlan } => row.plan !== undefined);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="caption">What loop are you in right now?</ThemedText>
        {rows.map(({ failurePoint, plan }) => (
          <Pressable
            key={failurePoint.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: '/execute/[planId]',
                params: { planId: plan.id, ...(source === 'scheduled' ? { source } : {}) },
              })
            }
            style={[styles.row, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.rowText}>
              <ThemedText type="defaultSemiBold">{failurePoint.label}</ThemedText>
              <ThemedText type="caption" numberOfLines={2}>
                {plan.triggerDescription}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={icon} />
          </Pressable>
        ))}
        {rows.length === 0 && (
          <ThemedText type="caption">
            No plans yet — add a pattern and plan in the Plans tab.
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
    gap: Spacing.sm + Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
  },
  rowText: {
    flex: 1,
    gap: Spacing.xs,
  },
});
