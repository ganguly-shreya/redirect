import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function VisionBoardScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Vision Board</ThemedText>
      <ThemedText type="caption">Grid lands in step 4.</ThemedText>
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
