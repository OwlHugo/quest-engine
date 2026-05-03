import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert, Modal } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { goalsApi } from '@/lib/queries';
import type { Goal } from '@/lib/types';
import { ColorPalette, font, radius, spacing } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Owl from '@/components/Owl';

type FormState = {
  id?: string;
  title: string;
  weekly_target: string;
  session_minutes: string;
};

const empty: FormState = { title: '', weekly_target: '3', session_minutes: '60' };

export default function Goals() {
  const qc = useQueryClient();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [form, setForm] = useState<FormState | null>(null);

  const goals = useQuery({ queryKey: ['goals'], queryFn: () => goalsApi.list() });

  const save = useMutation({
    mutationFn: (f: FormState) => {
      const payload = {
        title: f.title.trim(),
        weekly_target: Number(f.weekly_target),
        session_minutes: Number(f.session_minutes),
      };
      return f.id ? goalsApi.update(f.id, payload) : goalsApi.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); qc.invalidateQueries({ queryKey: ['quests'] }); setForm(null); },
    onError: (e: any) => Alert.alert('Ops', e.message ?? 'Falha'),
  });

  const archive = useMutation({
    mutationFn: (id: string) => goalsApi.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });

  function confirmArchive(g: Goal) {
    Alert.alert('Arquivar meta?', g.title, [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Arquivar', style: 'destructive', onPress: () => archive.mutate(g.id) },
    ]);
  }

  function fromGoal(g: Goal): FormState {
    return {
      id: g.id,
      title: g.title,
      weekly_target: String(g.weekly_target),
      session_minutes: String(g.session_minutes),
    };
  }

  const data = goals.data ?? [];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Metas</Text>
        <Text style={s.subtitle}>O que tu quer fazer toda semana</Text>
      </View>

      {data.length === 0 ? (
        <View style={s.emptyContent}>
          <Owl size={140} mood="happy" />
          <Text style={s.emptyTitle}>Sem metas ainda</Text>
          <Text style={s.emptyText}>Academia, estudo, leitura. Clica + pra criar.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(g) => g.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setForm(fromGoal(item))}
              onLongPress={() => confirmArchive(item)}
              style={({ pressed }) => [s.card, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <View style={s.cardIcon}>
                <Feather name="target" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{item.title}</Text>
                <Text style={s.cardMeta}>{item.weekly_target}x/semana · {item.session_minutes}min</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        />
      )}

      <Pressable style={s.fab} onPress={() => setForm(empty)}>
        <Feather name="plus" size={28} color={colors.textInverse} />
      </Pressable>

      <Modal visible={form !== null} animationType="slide" onRequestClose={() => setForm(null)} presentationStyle="pageSheet">
        {form && (
          <SafeAreaView style={s.modal} edges={['top', 'bottom']}>
            <View style={s.modalHeader}>
              <Pressable onPress={() => setForm(null)}><Feather name="x" size={26} color={colors.text} /></Pressable>
              <Text style={s.modalTitle}>{form.id ? 'Editar meta' : 'Nova meta'}</Text>
              <View style={{ width: 26 }} />
            </View>
            <View style={s.modalBody}>
              <Input placeholder="Título (ex: Academia)" value={form.title} onChangeText={(v) => setForm({ ...form, title: v })} />
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Vezes por semana</Text>
                  <Input keyboardType="numeric" value={form.weekly_target} onChangeText={(v) => setForm({ ...form, weekly_target: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Minutos por sessão</Text>
                  <Input keyboardType="numeric" value={form.session_minutes} onChangeText={(v) => setForm({ ...form, session_minutes: v })} />
                </View>
              </View>
            </View>
            <View style={s.modalFooter}>
              <Button label="Salvar" onPress={() => save.mutate(form)} loading={save.isPending} />
              {form.id && (
                <Button
                  label="Excluir meta"
                  variant="danger"
                  onPress={() => {
                    Alert.alert('Arquivar meta?', form.title, [
                      { text: 'Voltar', style: 'cancel' },
                      {
                        text: 'Arquivar',
                        style: 'destructive',
                        onPress: () => {
                          archive.mutate(form.id!);
                          setForm(null);
                        },
                      },
                    ]);
                  }}
                />
              )}
            </View>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: font.size.xxl, fontWeight: font.weight.heavy, color: colors.text },
  subtitle: { fontSize: font.size.md, color: colors.textMuted, fontWeight: font.weight.regular, marginTop: 2 },

  list: { paddingHorizontal: spacing.xl, paddingBottom: 100, gap: spacing.md },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    borderWidth: 2, borderColor: colors.border,
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: radius.pill,
    backgroundColor: colors.done, alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: font.size.lg, fontWeight: font.weight.heavy, color: colors.text },
  cardMeta: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.weight.bold, marginTop: 2 },

  emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: font.size.xl, fontWeight: font.weight.heavy, color: colors.text, marginTop: spacing.md },
  emptyText: { fontSize: font.size.md, color: colors.textMuted, textAlign: 'center', fontWeight: font.weight.regular },

  fab: {
    position: 'absolute', right: spacing.xl, bottom: spacing.xl,
    width: 60, height: 60, borderRadius: radius.pill,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, elevation: 6,
  },

  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 2, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: font.size.lg, fontWeight: font.weight.heavy, color: colors.text },
  modalBody: { padding: spacing.xl, gap: spacing.md, flex: 1 },
  modalFooter: { padding: spacing.xl, paddingTop: spacing.sm, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  label: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.weight.bold, marginBottom: spacing.xs },
  });
}
