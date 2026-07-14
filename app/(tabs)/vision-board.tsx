import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VisionImageGrid } from '@/components/vision-image-grid';
import { Spacing } from '@/constants/theme';
import { deleteImageFile, persistPickedImage } from '@/lib/images';
import { getCollection, removeFromCollection, setItem } from '@/lib/storage';
import type { VisionBoardImage } from '@/types/models';

export default function VisionBoardScreen() {
  const [images, setImages] = useState<VisionBoardImage[]>([]);

  useFocusEffect(
    useCallback(() => {
      getCollection('visionBoardImages').then(setImages);
    }, [])
  );

  const addImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.7,
    });
    if (result.canceled) return;
    const persisted = result.assets.map(persistPickedImage);
    const next = [...images, ...persisted];
    await setItem('visionBoardImages', next);
    setImages(next);
  };

  const removeImage = async (image: VisionBoardImage) => {
    deleteImageFile(image);
    await removeFromCollection('visionBoardImages', image.id);
    setImages((prev) => prev.filter((i) => i.id !== image.id));
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="caption">
          These images show up when a plan redirects you to your vision board.
        </ThemedText>
        {images.length < 3 && (
          <ThemedText type="caption">
            Tip: keep at least 3 images so the redirect stays fresh.
          </ThemedText>
        )}
        <VisionImageGrid images={images} onRemove={removeImage} />
        <PrimaryButton label="Add images" onPress={addImages} />
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
    gap: Spacing.md,
  },
});
