import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export function ThemedTextInput({ style, ...rest }: TextInputProps) {
  const text = useThemeColor({}, 'text');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const placeholder = useThemeColor({}, 'icon');

  return (
    <TextInput
      placeholderTextColor={placeholder}
      style={[
        styles.input,
        { color: text, backgroundColor: card, borderColor: border },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 16,
  },
});
