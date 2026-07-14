import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function RetroScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Retro</ThemedText>
      <ThemedText type="caption">Log review lands in step 7.</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.screen,
    gap: Spacing.sm,
  },
});
