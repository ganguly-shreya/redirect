import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getImageSource } from '@/lib/images';
import type { VisionBoardImage } from '@/types/models';

type VisionImageGridProps = {
  images: VisionBoardImage[];
  onRemove?: (image: VisionBoardImage) => void;
  // Selectable mode (goal editor): tapping a cell toggles membership instead of
  // removing; selected cells show a tinted border + checkmark badge.
  selectedIds?: string[];
  onToggleSelect?: (image: VisionBoardImage) => void;
};

const COLUMNS = 3;

export function VisionImageGrid({
  images,
  onRemove,
  selectedIds,
  onToggleSelect,
}: VisionImageGridProps) {
  const { width } = useWindowDimensions();
  const danger = useThemeColor({}, 'danger');
  const tint = useThemeColor({}, 'tint');
  // Measured container width so the grid also lays out correctly when nested
  // inside a padded card (goal editor); window-based fallback for first render.
  const [gridWidth, setGridWidth] = useState<number | null>(null);
  const available = gridWidth ?? width - Spacing.screen * 2;
  const cellSize = (available - Spacing.sm * (COLUMNS - 1)) / COLUMNS;

  return (
    <View style={styles.grid} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
      {images.map((image) => {
        const selected = selectedIds?.includes(image.id) ?? false;
        const cell = (
          <>
            <Image
              source={getImageSource(image)}
              style={[styles.image, onToggleSelect && selected && { borderColor: tint }]}
              contentFit="cover"
              transition={100}
            />
            {onToggleSelect && selected && (
              <View style={styles.selectBadge}>
                <Ionicons name="checkmark-circle" size={24} color={tint} />
              </View>
            )}
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
          </>
        );
        return onToggleSelect ? (
          <Pressable
            key={image.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={() => onToggleSelect(image)}
            style={{ width: cellSize, height: cellSize }}>
            {cell}
          </Pressable>
        ) : (
          <View key={image.id} style={{ width: cellSize, height: cellSize }}>
            {cell}
          </View>
        );
      })}
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  removeBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  selectBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
  },
});
