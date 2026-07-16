import { Directory, File, Paths } from 'expo-file-system';
import type * as ImagePicker from 'expo-image-picker';
import type { ImageSourcePropType } from 'react-native';

import { createId } from '@/lib/id';
import type { VisionBoardImage } from '@/types/models';

// Picker results live in the OS cache directory, which can be purged at any
// time — so every picked image is copied into the app document directory here.
// Uses the SDK 54 class-based expo-file-system API (File/Directory/Paths);
// the old promise API is at 'expo-file-system/legacy' — don't mix the two.

const VISION_DIR = new Directory(Paths.document, 'vision-board');

// Bundled default images ship as require()'d assets, not files, so they can't
// have file URIs. The 'bundled:<key>' sentinel in VisionBoardImage.uri keeps the
// spec's { uri: string } model intact; getImageSource() resolves the sentinel.
const BUNDLED_PREFIX = 'bundled:';

// Filenames are lowercase and space-free because Metro's asset-extension
// matching is case-sensitive — an uppercase .JPG gets parsed as source code.
const BUNDLED_ASSETS: Record<string, number> = {
  img0618: require('@/assets/images/vision-board/img_0618.jpg'),
  img0620: require('@/assets/images/vision-board/img_0620.jpg'),
  successfulDecade: require('@/assets/images/vision-board/successful-decade.jpeg'),
  ifNotNowWhen: require('@/assets/images/vision-board/if_not_now_when.jpg'),
  disciplineQuotes: require('@/assets/images/vision-board/discipline-quotes.jpg'),
  dontGiveUp: require('@/assets/images/vision-board/dont-give-up.jpg'),
};

export const BUNDLED_VISION_IMAGES: readonly VisionBoardImage[] = Object.keys(BUNDLED_ASSETS).map(
  (key) => ({
    id: `bundled-${key}`,
    uri: `${BUNDLED_PREFIX}${key}`,
  })
);

export function isBundledImage(image: VisionBoardImage): boolean {
  return image.uri.startsWith(BUNDLED_PREFIX);
}

export function persistPickedImage(asset: ImagePicker.ImagePickerAsset): VisionBoardImage {
  if (!VISION_DIR.exists) VISION_DIR.create({ intermediates: true });
  const id = createId();
  const dest = new File(VISION_DIR, `${id}.jpg`);
  new File(asset.uri).copy(dest);
  return { id, uri: dest.uri };
}

// Removing a bundled image is a storage-only operation — its asset stays in the
// app binary; only user-picked copies have a file to delete.
export function deleteImageFile(image: VisionBoardImage): void {
  if (isBundledImage(image)) return;
  const file = new File(image.uri);
  if (file.exists) file.delete();
}

// Dev-only full reset: wipes every user-picked image copy. Bundled assets live
// in the app binary and are unaffected.
export function deleteAllImageFiles(): void {
  if (VISION_DIR.exists) VISION_DIR.delete();
}

export function getImageSource(image: VisionBoardImage): ImageSourcePropType {
  if (isBundledImage(image)) {
    const key = image.uri.slice(BUNDLED_PREFIX.length);
    const asset = BUNDLED_ASSETS[key];
    if (asset !== undefined) return asset;
  }
  return { uri: image.uri };
}
