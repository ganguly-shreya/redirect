import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getImageSource } from '@/lib/images';
import type { VisionBoardImage } from '@/types/models';

type VisionImageGridProps = {
  images: VisionBoardImage[];
  onRemove?: (image: VisionBoardImage) => void;
};

const COLUMNS = 3;

export function VisionImageGrid({ images, onRemove }: VisionImageGridProps) {
  const { width } = useWindowDimensions();
  const danger = useThemeColor({}, 'danger');
  const cellSize = (width - Spacing.screen * 2 - Spacing.sm * (COLUMNS - 1)) / COLUMNS;

  return (
    <View style={styles.grid}>
      {images.map((image) => (
        <View key={image.id} style={{ width: cellSize, height: cellSize }}>
          <Image
            source={getImageSource(image)}
            style={styles.image}
            contentFit="cover"
            transition={100}
          />
          {onRemove && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove image"
              hitSlop={8}
              onPress={() => onRemove(image)}
              style={styles.removeBadge}>
              <Ionicons name="close-circle" size={24} color={danger} />
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  image: {
    flex: 1,
    borderRadius: Radius.card,
  },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
});
