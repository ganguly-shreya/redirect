import { useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// Placeholder: plan execution lands in step 6.
export default function ExecuteScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle">Executing plan {planId}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.screen,
  },
});
