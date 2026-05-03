import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert, Modal } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { blocksApi } from '@/lib/queries';
import type { Block } from '@/lib/types';
import { ColorPalette, font, radius, spacing } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Owl from '@/components/Owl';

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

type FormState = {
  id?: string;
  name: string;
  weekdays: number[];
  start_time: string;
  end_time: string;
};

const empty: FormState = { name: '', weekdays: [1, 2, 3, 4, 5], start_time: '08:00', end_time: '17:00' };

export default function Blocks() {
  const qc = useQueryClient();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [form, setForm] = useState<FormState | null>(null);

  const blocks = useQuery({ queryKey: ['blocks'], queryFn: () => blocksApi.list() });

  const save = useMutation({
    mutationFn: (f: FormState) => {
      const payload = {
        name: f.name.trim(),
        weekdays: f.weekdays,
        start_time: f.start_time,
        end_time: f.end_time,
      };
      return f.id ? blocksApi.update(f.id, payload) : blocksApi.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['blocks'] }); qc.invalidateQueries({ queryKey: ['quests'] }); setForm(null); },
    onError: (e: any) => Alert.alert('Ops', e.message ?? 'Falha'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => blocksApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocks'] }),
  });

  function confirmRemove(b: Block) {
    Alert.alert('Excluir bloco?', b.name, [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => remove.mutate(b.id) },
    ]);
  }

  function fromBlock(b: Block): FormState {
    return {
      id: b.id,
      name: b.name,
      weekdays: b.weekdays,
      start_time: b.start_time.slice(0, 5),
      end_time: b.end_time.slice(0, 5),
    };
  }

  function toggleDay(d: number) {
    if (!form) return;
    const has = form.weekdays.includes(d);
    setForm({ ...form, weekdays: has ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d].sort() });
  }

  const data = blocks.data ?? [];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Blocos fixos</Text>
        <Text style={s.subtitle}>Quando tu já tá ocupado</Text>
      </View>

      {data.length === 0 ? (
        <View style={s.emptyContent}>
          <Owl size={140} mood="sleepy" />
          <Text style={s.emptyTitle}>Sem blocos ainda</Text>
          <Text style={s.emptyText}>Trabalho, faculdade, sono. Eu evito esses horários.</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(b) => b.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setForm(fromBlock(item))}
              onLongPress={() => confirmRemove(item)}
              style={({ pressed }) => [s.card, pressed && { transform: [{ scale: 0.98 }] }]}
            >
              <View style={s.cardIcon}>
                <Feather name="clock" size={22} color={colors.infoDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{item.name}</Text>
                <Text style={s.cardMeta}>
                  {item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)} · {item.weekdays.map((d) => DAY_LABELS[d - 1]).join(', ')}
                </Text>
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
              <Text style={s.modalTitle}>{form.id ? 'Editar bloco' : 'Novo bloco'}</Text>
              <View style={{ width: 26 }} />
            </View>
            <View style={s.modalBody}>
              <Input placeholder="Nome (ex: Trabalho)" value={form.name} onChangeText={(v) => setForm({ ...form, name: v })} />

              <Text style={s.label}>Dias da semana</Text>
              <View style={s.daysRow}>
                {DAY_LABELS.map((label, idx) => {
                  const day = idx + 1;
                  const active = form.weekdays.includes(day);
                  return (
                    <Pressable
                      key={day}
                      onPress={() => toggleDay(day)}
                      style={[s.dayChip, active && s.dayChipActive]}
                    >
                      <Text style={active ? s.dayChipTextActive : s.dayChipText}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Início</Text>
                  <Input placeholder="HH:MM" value={form.start_time} onChangeText={(v) => setForm({ ...form, start_time: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Fim</Text>
                  <Input placeholder="HH:MM" value={form.end_time} onChangeText={(v) => setForm({ ...form, end_time: v })} />
                </View>
              </View>
            </View>
            <View style={s.modalFooter}>
              <Button label="Salvar" onPress={() => save.mutate(form)} loading={save.isPending} />
              {form.id && (
                <Button
                  label="Excluir bloco"
                  variant="danger"
                  onPress={() => {
                    Alert.alert('Excluir bloco?', form.name, [
                      { text: 'Voltar', style: 'cancel' },
                      {
                        text: 'Excluir',
                        style: 'destructive',
                        onPress: () => {
                          remove.mutate(form.id!);
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
    backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center',
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

  daysRow: { flexDirection: 'row', gap: 6, justifyContent: 'space-between' },
  dayChip: {
    flex: 1, paddingVertical: 12,
    borderWidth: 2, borderColor: colors.border, borderRadius: radius.md,
    alignItems: 'center', backgroundColor: colors.bgMuted,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primaryDark },
  dayChipText: { color: colors.textMuted, fontSize: font.size.sm, fontWeight: font.weight.bold },
  dayChipTextActive: { color: colors.textInverse, fontSize: font.size.sm, fontWeight: font.weight.heavy },
  });
}
