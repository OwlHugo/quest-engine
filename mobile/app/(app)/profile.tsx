import { useMemo } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { apiUrl } from '@/lib/api';
import {
  ColorPalette,
  font,
  paletteOrder,
  PaletteName,
  palettes,
  radius,
  spacing,
  ThemeMode,
} from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import Button from '@/components/Button';
import Owl from '@/components/Owl';

export default function Profile() {
  const { user, signOut } = useAuth();
  const { colors, mode, setMode, paletteName, setPalette, isDark } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  function confirmSignOut() {
    Alert.alert('Sair?', '', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.hero}>
          <Owl size={120} mood="happy" />
          <Text style={s.email}>{user?.email}</Text>
        </View>

        <View style={s.infoCard}>
          <Row icon="globe" label="Fuso horário" value={user?.timezone ?? '—'} colors={colors} />
          <Row icon="link" label="API" value={apiUrl} colors={colors} />
        </View>

        <View>
          <Text style={s.sectionLabel}>Tema</Text>
          <View style={s.segmented}>
            <ThemeOption label="Claro" mode="light" current={mode} onPick={setMode} colors={colors} />
            <ThemeOption label="Escuro" mode="dark" current={mode} onPick={setMode} colors={colors} />
            <ThemeOption label="Sistema" mode="system" current={mode} onPick={setMode} colors={colors} />
          </View>
        </View>

        <View>
          <Text style={s.sectionLabel}>Paleta</Text>
          <View style={s.paletteGrid}>
            {paletteOrder.map((name) => (
              <PaletteSwatch
                key={name}
                name={name}
                isSelected={paletteName === name}
                isDark={isDark}
                onPick={() => setPalette(name)}
                outerColors={colors}
              />
            ))}
          </View>
        </View>

        <Button label="Sair" onPress={confirmSignOut} variant="danger" />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value, colors }: { icon: 'globe' | 'link'; label: string; value: string; colors: ColorPalette }) {
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.row}>
      <Feather name={icon} size={18} color={colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.value} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function ThemeOption({
  label, mode, current, onPick, colors,
}: { label: string; mode: ThemeMode; current: ThemeMode; onPick: (m: ThemeMode) => void; colors: ColorPalette }) {
  const isActive = current === mode;
  return (
    <Pressable
      onPress={() => onPick(mode)}
      style={{
        flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.md,
        backgroundColor: isActive ? colors.primary : 'transparent',
      }}
    >
      <Text style={{
        fontSize: font.size.sm,
        fontWeight: font.weight.heavy,
        color: isActive ? colors.textInverse : colors.text,
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

function PaletteSwatch({
  name, isSelected, isDark, onPick, outerColors,
}: {
  name: PaletteName;
  isSelected: boolean;
  isDark: boolean;
  onPick: () => void;
  outerColors: ColorPalette;
}) {
  const set = palettes[name];
  const previewColors = isDark ? set.dark : set.light;

  return (
    <Pressable
      onPress={onPick}
      style={{
        flexBasis: '48%',
        borderRadius: radius.md,
        borderWidth: 2,
        borderColor: isSelected ? outerColors.primary : outerColors.border,
        backgroundColor: outerColors.cardBg,
        padding: spacing.sm,
        gap: spacing.xs,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: font.size.sm, fontWeight: font.weight.heavy, color: outerColors.text }}>
          {set.emoji} {set.label}
        </Text>
        {isSelected && <Feather name="check" size={14} color={outerColors.primary} />}
      </View>
      <View style={{ flexDirection: 'row', height: 24, borderRadius: 6, overflow: 'hidden' }}>
        <View style={{ flex: 1, backgroundColor: previewColors.primary }} />
        <View style={{ flex: 1, backgroundColor: previewColors.accent }} />
        <View style={{ flex: 1, backgroundColor: previewColors.bg }} />
        <View style={{ flex: 1, backgroundColor: previewColors.bgMuted }} />
        <View style={{ flex: 1, backgroundColor: previewColors.text }} />
      </View>
    </Pressable>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.xl, gap: spacing.lg },
    hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg, paddingBottom: spacing.xl },
    email: { fontSize: font.size.lg, fontWeight: font.weight.heavy, color: colors.text },

    infoCard: {
      backgroundColor: colors.cardBg,
      borderRadius: radius.lg,
      borderWidth: 2, borderColor: colors.border,
      padding: spacing.md,
      gap: spacing.md,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    label: { fontSize: font.size.xs, color: colors.textMuted, fontWeight: font.weight.bold, textTransform: 'uppercase' },
    value: { fontSize: font.size.md, color: colors.text, fontWeight: font.weight.regular, marginTop: 2 },

    sectionLabel: { fontSize: font.size.xs, color: colors.textMuted, fontWeight: font.weight.bold, textTransform: 'uppercase', marginBottom: spacing.xs },
    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.bgMuted,
      borderRadius: radius.md,
      padding: 4,
      borderWidth: 2,
      borderColor: colors.border,
    },

    paletteGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
  });
}
