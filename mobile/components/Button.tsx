import { Pressable, Text, StyleSheet, ViewStyle, View } from 'react-native';
import { useMemo } from 'react';
import { radius, spacing, font } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';

type Variant = 'primary' | 'accent' | 'danger' | 'ghost' | 'info';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export default function Button({ label, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const { colors } = useTheme();
  const palette = useMemo(() => ({
    primary: { bg: colors.primary,  shadow: colors.primaryDark, text: colors.textInverse },
    accent:  { bg: colors.accent,   shadow: colors.accentDark,  text: colors.textInverse },
    danger:  { bg: colors.danger,   shadow: colors.dangerDark,  text: colors.textInverse },
    info:    { bg: colors.info,     shadow: colors.infoDark,    text: colors.textInverse },
    ghost:   { bg: colors.bg,       shadow: colors.borderStrong,text: colors.text },
  }), [colors]);

  const c = palette[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.wrapper,
        { backgroundColor: c.shadow, opacity: disabled ? 0.5 : 1 },
        pressed && s.wrapperPressed,
        style,
      ]}
    >
      {({ pressed }) => (
        <View
          style={[
            s.inner,
            { backgroundColor: c.bg, transform: [{ translateY: pressed ? 4 : 0 }] },
            variant === 'ghost' && { borderWidth: 2, borderColor: colors.border },
          ]}
        >
          <Text style={[s.label, { color: c.text }]}>{loading ? '...' : label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrapper: { borderRadius: radius.lg, paddingBottom: 4 },
  wrapperPressed: { paddingBottom: 0, marginTop: 4 },
  inner: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: font.size.lg, fontWeight: font.weight.heavy, letterSpacing: 0.5, textTransform: 'uppercase' },
});
