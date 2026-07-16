import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountdownTimer } from '@/components/countdown-timer';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getImageSource } from '@/lib/images';
import {
  logTriggerFired,
  pickGoalRedirectContent,
  pickRandomVisionImage,
  type GoalRedirectContent,
} from '@/lib/plan-engine';
import { getCollection } from '@/lib/storage';
import type { FailurePoint, Goal, IfThenPlan, VisionBoardImage } from '@/types/models';

function formatTargetDate(goal: Goal): string {
  const days = differenceInCalendarDays(parseISO(goal.targetDate), new Date());
  if (days > 1) return `${days} days to go`;
  if (days === 1) return 'Tomorrow is the day';
  if (days === 0) return 'Today is the day';
  return `Target was ${format(parseISO(goal.targetDate), 'MMM d, yyyy')}`;
}

// Runs a plan's corrective action. This screen is the only TriggerLog write
// point — anything that executes a plan must navigate here.
export default function ExecuteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { planId, source } = useLocalSearchParams<{ planId: string; source?: string }>();

  const [plan, setPlan] = useState<IfThenPlan | null>(null);
  const [failurePoint, setFailurePoint] = useState<FailurePoint | null>(null);
  const [goalContent, setGoalContent] = useState<GoalRedirectContent | null>(null);
  const [visionImage, setVisionImage] = useState<VisionBoardImage | null>(null);
  const [notFound, setNotFound] = useState(false);
  const tint = useThemeColor({}, 'tint');
  // Ref guard: React Compiler / dev StrictMode can double-run effects, which
  // would otherwise write two TriggerLogs per execution.
  const loggedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const plans = await getCollection('plans');
      const found = plans.find((p) => p.id === planId) ?? null;
      if (cancelled) return;
      if (!found) {
        setNotFound(true);
        return;
      }
      setPlan(found);

      const failurePoints = await getCollection('failurePoints');
      if (cancelled) return;
      const foundFailurePoint = failurePoints.find((fp) => fp.id === found.failurePointId) ?? null;
      setFailurePoint(foundFailurePoint);

      if (found.actionType === 'visionBoard') {
        const [images, goals, quotes] = await Promise.all([
          getCollection('visionBoardImages'),
          getCollection('goals'),
          getCollection('quotes'),
        ]);
        if (cancelled) return;
        // Goal-driven redirect: a random image or quote from the pattern's
        // connected goals. Falls back to the V1 random-pool image only for
        // pre-V2 patterns that have no linked goals.
        const content = foundFailurePoint
          ? pickGoalRedirectContent(foundFailurePoint, goals, images, quotes)
          : null;
        setGoalContent(content);
        if (!content) {
          const specific = found.actionConfig.imageId
            ? images.find((i) => i.id === found.actionConfig.imageId)
            : undefined;
          setVisionImage(specific ?? pickRandomVisionImage(images));
        }
      }

      if (!loggedRef.current) {
        loggedRef.current = true;
        await logTriggerFired(found.id, source === 'scheduled' ? 'scheduled' : 'manual');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [planId, source]);

  // Pops the execute fullScreenModal and the stuck modal in one go.
  const done = () => router.dismissAll();

  if (notFound) {
    return (
      <ThemedView style={[styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ThemedText type="subtitle">This plan no longer exists.</ThemedText>
        <PrimaryButton label="Done" onPress={done} />
      </ThemedView>
    );
  }

  if (!plan) return <ThemedView style={styles.centered} />;

  const renderAction = () => {
    switch (plan.actionType) {
      case 'timer':
        return (
          <View style={styles.actionBody}>
            <ThemedText type="caption">{failurePoint?.label}</ThemedText>
            <ThemedText type="subtitle" style={styles.centerText}>
              {plan.triggerDescription}
            </ThemedText>
            <CountdownTimer durationMinutes={plan.actionConfig.durationMinutes ?? 5} />
            <ThemedText type="caption">Stay with it until the timer ends.</ThemedText>
          </View>
        );
      case 'visionBoard': {
        // A block of white text reminding the user what they're working toward
        // and why — shared by the image overlay and the quote/goal cards.
        const goalReminder = (goal: Goal) => (
          <View style={styles.goalReminder}>
            <ThemedText
              type="subtitle"
              lightColor="#FFFFFF"
              darkColor="#FFFFFF"
              style={styles.centerText}>
              {goal.title}
            </ThemedText>
            <ThemedText
              lightColor="#FFFFFF"
              darkColor="#FFFFFF"
              style={styles.centerText}>
              {goal.why}
            </ThemedText>
            <ThemedText type="caption" lightColor="#FFFFFFCC" darkColor="#FFFFFFCC">
              {formatTargetDate(goal)}
            </ThemedText>
          </View>
        );

        if (goalContent?.kind === 'image') {
          return (
            <View style={styles.fill}>
              <Image
                source={getImageSource(goalContent.image)}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.scrim} />
              <View style={styles.overlay}>{goalReminder(goalContent.goal)}</View>
            </View>
          );
        }
        if (goalContent?.kind === 'quote') {
          return (
            <View style={[styles.fill, styles.goalCard, { backgroundColor: tint }]}>
              <ThemedText
                lightColor="#FFFFFF"
                darkColor="#FFFFFF"
                style={[styles.centerText, styles.quoteText]}>
                “{goalContent.quote.text}”
              </ThemedText>
              {goalReminder(goalContent.goal)}
            </View>
          );
        }
        if (goalContent?.kind === 'goal') {
          return (
            <View style={[styles.fill, styles.goalCard, { backgroundColor: tint }]}>
              <ThemedText type="caption" lightColor="#FFFFFFCC" darkColor="#FFFFFFCC">
                Remember what this is for
              </ThemedText>
              <ThemedText
                type="title"
                lightColor="#FFFFFF"
                darkColor="#FFFFFF"
                style={styles.centerText}>
                {goalContent.goal.title}
              </ThemedText>
              <ThemedText
                type="subtitle"
                lightColor="#FFFFFF"
                darkColor="#FFFFFF"
                style={styles.centerText}>
                {goalContent.goal.why}
              </ThemedText>
              <ThemedText type="caption" lightColor="#FFFFFFCC" darkColor="#FFFFFFCC">
                {formatTargetDate(goalContent.goal)}
              </ThemedText>
            </View>
          );
        }
        // Pre-V2 fallback: pattern has no linked goals — V1 random-pool image.
        return (
          <View style={styles.fill}>
            {visionImage ? (
              <Image
                source={getImageSource(visionImage)}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <ThemedText type="subtitle" style={styles.centerText}>
                Your vision board is empty — add images to your goals in the Goals tab.
              </ThemedText>
            )}
            <View style={styles.scrim} />
            <View style={styles.overlay}>
              <ThemedText
                type="subtitle"
                lightColor="#FFFFFF"
                darkColor="#FFFFFF"
                style={styles.centerText}>
                {plan.actionConfig.message ?? plan.triggerDescription}
              </ThemedText>
            </View>
          </View>
        );
      }
      case 'customMessage':
        return (
          <View style={styles.actionBody}>
            <ThemedText type="caption">{failurePoint?.label}</ThemedText>
            <ThemedText type="title" style={styles.centerText}>
              {plan.actionConfig.message ?? ''}
            </ThemedText>
          </View>
        );
      default: {
        // Exhaustiveness guard: a new ActionType fails tsc here until rendered.
        const _exhaustive: never = plan.actionType;
        return _exhaustive;
      }
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {renderAction()}
      <View style={styles.footer}>
        <PrimaryButton label="Done" onPress={done} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    padding: Spacing.screen,
  },
  actionBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    padding: Spacing.screen,
  },
  fill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  overlay: {
    padding: Spacing.screen,
  },
  goalReminder: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  goalCard: {
    gap: Spacing.lg,
    padding: Spacing.screen,
    alignSelf: 'stretch',
  },
  quoteText: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: '600',
  },
  centerText: {
    textAlign: 'center',
  },
  footer: {
    padding: Spacing.screen,
  },
});
