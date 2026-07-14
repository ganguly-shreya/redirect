import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  size?: 'default' | 'large';
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  size = 'default',
  style,
}: PrimaryButtonProps) {
  const tint = useThemeColor({}, 'tint');
  const scheme = useColorScheme() ?? 'light';
  // The dark-mode tint is a light teal, so dark text keeps contrast there.
  const labelColor = scheme === 'dark' ? '#0B0B0D' : '#FFFFFF';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        size === 'large' && styles.large,
        { backgroundColor: tint, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        style,
      ]}>
      <ThemedText
        lightColor={labelColor}
        darkColor={labelColor}
        type="defaultSemiBold"
        style={size === 'large' ? styles.largeText : undefined}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  large: {
    alignSelf: 'stretch',
    height: 64,
  },
  largeText: {
    fontSize: 20,
  },
});
