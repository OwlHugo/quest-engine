import { View, StyleSheet, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { radius, spacing } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  borderColor?: string;
  bg?: string;
};

export default function Card({ children, style, borderColor, bg }: Props) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        s.card,
        { backgroundColor: bg ?? colors.cardBg, borderColor: borderColor ?? colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 2,
    padding: spacing.lg,
  },
});
