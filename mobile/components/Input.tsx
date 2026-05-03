import { TextInput, StyleSheet, TextInputProps, View } from 'react-native';
import { font, radius, spacing } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';

export default function Input(props: TextInputProps) {
  const { colors } = useTheme();
  return (
    <View style={s.wrapper}>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...props}
        style={[
          s.input,
          { borderColor: colors.border, backgroundColor: colors.bgMuted, color: colors.text },
          props.style,
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { width: '100%' },
  input: {
    borderWidth: 2,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    fontSize: font.size.lg,
    fontWeight: font.weight.regular,
  },
});
