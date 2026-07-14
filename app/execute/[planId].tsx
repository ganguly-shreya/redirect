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
import { getImageSource } from '@/lib/images';
import { logTriggerFired, pickRandomVisionImage } from '@/lib/plan-engine';
import { getCollection } from '@/lib/storage';
import type { FailurePoint, IfThenPlan, VisionBoardImage } from '@/types/models';

// Runs a plan's corrective action. This screen is the only TriggerLog write
// point — anything that executes a plan must navigate here.
export default function ExecuteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { planId, source } = useLocalSearchParams<{ planId: string; source?: string }>();

  const [plan, setPlan] = useState<IfThenPlan | null>(null);
  const [failurePoint, setFailurePoint] = useState<FailurePoint | null>(null);
  const [visionImage, setVisionImage] = useState<VisionBoardImage | null>(null);
  const [notFound, setNotFound] = useState(false);
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
      setFailurePoint(failurePoints.find((fp) => fp.id === found.failurePointId) ?? null);

      if (found.actionType === 'visionBoard') {
        const images = await getCollection('visionBoardImages');
        if (cancelled) return;
        const specific = found.actionConfig.imageId
          ? images.find((i) => i.id === found.actionConfig.imageId)
          : undefined;
        setVisionImage(specific ?? pickRandomVisionImage(images));
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
      case 'visionBoard':
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
                Your vision board is empty — add images in the Vision Board tab.
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
  centerText: {
    textAlign: 'center',
  },
  footer: {
    padding: Spacing.screen,
  },
});
