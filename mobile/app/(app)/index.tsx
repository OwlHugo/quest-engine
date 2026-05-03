import { useMemo } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet, Alert, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { questsApi, goalsApi, blocksApi } from '@/lib/queries';
import { api } from '@/lib/api';
import type { Quest, Goal } from '@/lib/types';
import { ColorPalette, font, radius, spacing } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import Owl from '@/components/Owl';
import Button from '@/components/Button';

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Today() {
  const qc = useQueryClient();
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  const blocks = useQuery({ queryKey: ['blocks'], queryFn: () => blocksApi.list() });
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => goalsApi.list() });
  const quests = useQuery({ queryKey: ['quests', 0], queryFn: () => questsApi.list('current') });

  const goalById = useMemo<Map<string, Goal>>(() => {
    const m = new Map<string, Goal>();
    (goals.data ?? []).forEach((g) => m.set(g.id, g));
    return m;
  }, [goals.data]);

  const todayQuests = useMemo<Quest[]>(
    () => (quests.data ?? []).filter((q) => isToday(q.scheduled_for) && goalById.has(q.goal_id)),
    [quests.data, goalById],
  );

  const doneCount = todayQuests.filter((q) => q.status === 'done').length;
  const total = todayQuests.length;

  const done = useMutation({
    mutationFn: (id: string) => questsApi.done(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }),
  });

  const undo = useMutation({
    mutationFn: (id: string) => questsApi.undo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }),
  });

  const skip = useMutation({
    mutationFn: () => questsApi.skipToday(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }),
    onError: (e: any) => Alert.alert('Ops', e.message ?? 'Falha'),
  });

  const regenerate = useMutation({
    mutationFn: () => api('POST', '/quests/regenerate'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }),
  });

  function confirmSkip() {
    Alert.alert('Pular hoje?', 'Quests do dia viram puladas. Limite: 1x por semana.', [
      { text: 'Voltar', style: 'cancel' },
      { text: 'Pular', style: 'destructive', onPress: () => skip.mutate() },
    ]);
  }

  if (blocks.isLoading || goals.isLoading || quests.isLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><Text style={s.loading}>...</Text></View>
      </SafeAreaView>
    );
  }

  const hasBlocks = (blocks.data ?? []).length > 0;
  const hasGoals = (goals.data ?? []).length > 0;

  if (!hasBlocks) {
    return (
      <Empty
        owlMood="wave"
        title="Primeiro: tua agenda"
        text="Cadastra trabalho, faculdade, sono. Eu encaixo as quests no resto."
        ctaLabel="Cadastrar blocos"
        onCta={() => router.push('/(app)/blocks')}
      />
    );
  }

  if (!hasGoals) {
    return (
      <Empty
        owlMood="happy"
        title="Agora: tuas metas"
        text="Academia, estudo, projeto pessoal. Quantas vezes por semana?"
        ctaLabel="Criar minha primeira meta"
        onCta={() => router.push('/(app)/goals')}
      />
    );
  }

  if (todayQuests.length === 0) {
    return (
      <Empty
        owlMood="sleepy"
        title="Hoje sem quests"
        text="Pode ser folga ou só falta gerar. Toca pra forçar."
        ctaLabel="Gerar minha semana"
        onCta={() => regenerate.mutate()}
        loading={regenerate.isPending}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.greeting}>{greeting()}</Text>
          <Text style={s.title}>Hoje</Text>
        </View>
        <Owl size={64} mood={doneCount === total && total > 0 ? 'happy' : 'wave'} />
      </View>

      <View style={s.progressBox}>
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${total ? (doneCount / total) * 100 : 0}%` }]} />
        </View>
        <Text style={s.progressText}>{doneCount}/{total} concluídas</Text>
      </View>

      <FlatList
        contentContainerStyle={s.list}
        data={todayQuests}
        keyExtractor={(q) => q.id}
        refreshControl={<RefreshControl refreshing={quests.isFetching} onRefresh={() => quests.refetch()} tintColor={colors.primary} />}
        renderItem={({ item }) => {
          const goal = goalById.get(item.goal_id);
          const isDone = item.status === 'done';
          const isSkipped = item.status === 'skipped';
          return (
            <Pressable
              onPress={() => {
                if (item.status === 'pending') done.mutate(item.id);
                else undo.mutate(item.id);
              }}
              style={({ pressed }) => [
                s.card,
                isDone && s.cardDone,
                isSkipped && s.cardSkipped,
                pressed && { transform: [{ scale: 0.98 }] },
              ]}
            >
              <View style={s.cardLeft}>
                <View style={[s.iconBubble, isDone && s.iconBubbleDone]}>
                  <Feather
                    name={isDone ? 'check' : isSkipped ? 'x' : 'zap'}
                    size={18}
                    color={isDone ? colors.primary : isSkipped ? colors.danger : colors.accentDark}
                  />
                </View>
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardTitle}>{goal?.title ?? '—'}</Text>
                <Text style={s.cardMeta}>
                  {formatTime(item.scheduled_for)} · {goal?.session_minutes}min
                </Text>
              </View>
              {item.status === 'pending' && <Feather name="chevron-right" size={20} color={colors.textMuted} />}
            </Pressable>
          );
        }}
      />

      <View style={s.footer}>
        <Button label="Hoje tá pesado" onPress={confirmSkip} variant="ghost" loading={skip.isPending} />
      </View>
    </SafeAreaView>
  );
}

function Empty({
  owlMood,
  title,
  text,
  ctaLabel,
  onCta,
  loading,
}: {
  owlMood: 'happy' | 'wave' | 'sleepy';
  title: string;
  text: string;
  ctaLabel: string;
  onCta: () => void;
  loading?: boolean;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.emptyContent}>
        <Owl size={180} mood={owlMood} />
        <Text style={s.emptyTitle}>{title}</Text>
        <Text style={s.emptyText}>{text}</Text>
      </View>
      <View style={s.footer}>
        <Button label={ctaLabel} onPress={onCta} loading={loading} />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loading: { fontSize: font.size.xl, color: colors.textMuted },

    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm },
    greeting: { fontSize: font.size.md, color: colors.textMuted, fontWeight: font.weight.regular },
    title: { fontSize: font.size.xxl, fontWeight: font.weight.heavy, color: colors.text },

    progressBox: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.xs },
    progressBar: { height: 14, backgroundColor: colors.bgMuted, borderRadius: radius.pill, overflow: 'hidden', borderWidth: 2, borderColor: colors.border },
    progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.pill },
    progressText: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.weight.bold },

    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },

    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardBg,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.md,
    },
    cardDone: { backgroundColor: colors.done, borderColor: colors.primary },
    cardSkipped: { backgroundColor: colors.skipped, borderColor: colors.danger, opacity: 0.7 },
    cardLeft: {},
    cardBody: { flex: 1 },
    iconBubble: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bgMuted, alignItems: 'center', justifyContent: 'center' },
    iconBubbleDone: { backgroundColor: colors.bg },
    cardTitle: { fontSize: font.size.lg, fontWeight: font.weight.heavy, color: colors.text },
    cardMeta: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.weight.bold, marginTop: 2 },

    footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, paddingTop: spacing.sm },

    emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
    emptyTitle: { fontSize: font.size.xl, fontWeight: font.weight.heavy, color: colors.text, textAlign: 'center', marginTop: spacing.lg },
    emptyText: { fontSize: font.size.md, color: colors.textMuted, textAlign: 'center', fontWeight: font.weight.regular, lineHeight: 22 },
  });
}
