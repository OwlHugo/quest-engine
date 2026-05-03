import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Modal, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { questsApi, goalsApi, blocksApi, eventsApi } from '@/lib/queries';
import type { Quest, Goal, Block, Event } from '@/lib/types';
import { ColorPalette, font, radius, spacing } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import Button from '@/components/Button';
import Input from '@/components/Input';

const HOUR_HEIGHT = 64;
const HOURS_START = 6;
const HOURS_END = 24;
const HOURS_RANGE = HOURS_END - HOURS_START;
const DAY_HEIGHT = HOURS_RANGE * HOUR_HEIGHT;
const TIME_COL_WIDTH = 44;

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function startOfWeek(d: Date): Date {
  const wd = d.getDay() === 0 ? 7 : d.getDay();
  const m = new Date(d);
  m.setDate(d.getDate() - wd + 1);
  m.setHours(0, 0, 0, 0);
  return m;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function minutesFromDayStart(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() - HOURS_START * 60;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

type EventForm = {
  date: Date;
  title: string;
  startTime: string;
  endTime: string;
};

type TimelineItem =
  | { kind: 'block'; id: string; title: string; startMin: number; endMin: number }
  | { kind: 'event'; id: string; title: string; startMin: number; endMin: number }
  | { kind: 'quest'; id: string; title: string; startMin: number; endMin: number; status: 'pending' | 'done' | 'skipped' };

export default function Agenda() {
  const today = new Date();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<Date>(today);
  const [eventForm, setEventForm] = useState<EventForm | null>(null);
  const [now, setNow] = useState(new Date());
  const scrollRef = useRef<ScrollView>(null);
  const qc = useQueryClient();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  const baseWeekStart = useMemo(() => startOfWeek(today), []);
  const weekStart = useMemo(() => addDays(baseWeekStart, weekOffset * 7), [baseWeekStart, weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const blocks = useQuery({ queryKey: ['blocks'], queryFn: () => blocksApi.list() });
  const goals = useQuery({ queryKey: ['goals'], queryFn: () => goalsApi.list() });
  const quests = useQuery({ queryKey: ['quests', weekOffset], queryFn: () => questsApi.list(weekOffset > 0 ? 'next' : 'current') });
  const events = useQuery({ queryKey: ['events', weekOffset], queryFn: () => eventsApi.list(weekOffset > 0 ? 'next' : 'current') });

  const goalById = useMemo<Map<string, Goal>>(() => {
    const m = new Map<string, Goal>();
    (goals.data ?? []).forEach((g) => m.set(g.id, g));
    return m;
  }, [goals.data]);

  const dayItems = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    const wd = selectedDay.getDay() === 0 ? 7 : selectedDay.getDay();

    (blocks.data ?? []).forEach((b: Block) => {
      if (!b.weekdays.includes(wd)) return;
      items.push({
        kind: 'block',
        id: b.id,
        title: b.name,
        startMin: hmToMinutes(b.start_time) - HOURS_START * 60,
        endMin: hmToMinutes(b.end_time) - HOURS_START * 60,
      });
    });

    (events.data ?? []).forEach((e: Event) => {
      const s = new Date(e.starts_at);
      if (!sameDay(s, selectedDay)) return;
      const en = new Date(e.ends_at);
      items.push({
        kind: 'event',
        id: e.id,
        title: e.title,
        startMin: minutesFromDayStart(s),
        endMin: minutesFromDayStart(en),
      });
    });

    (quests.data ?? []).forEach((q: Quest) => {
      const goal = goalById.get(q.goal_id);
      if (!goal) return;
      const s = new Date(q.scheduled_for);
      if (!sameDay(s, selectedDay)) return;
      items.push({
        kind: 'quest',
        id: q.id,
        title: goal.title,
        startMin: minutesFromDayStart(s),
        endMin: minutesFromDayStart(s) + goal.session_minutes,
        status: q.status,
      });
    });

    return items;
  }, [blocks.data, events.data, quests.data, goalById, selectedDay]);

  const dayStats = useMemo(() => {
    const quests = dayItems.filter((i) => i.kind === 'quest');
    const events = dayItems.filter((i) => i.kind === 'event');
    return {
      questsTotal: quests.length,
      questsDone: quests.filter((q) => q.kind === 'quest' && q.status === 'done').length,
      events: events.length,
    };
  }, [dayItems]);

  // Auto-scroll on day change: today → now, other days → 7h
  useEffect(() => {
    let targetMin: number;
    if (sameDay(selectedDay, now)) {
      targetMin = now.getHours() * 60 + now.getMinutes() - HOURS_START * 60;
    } else {
      targetMin = 60; // 7h
    }
    const y = Math.max(0, (targetMin / 60) * HOUR_HEIGHT - 100);
    scrollRef.current?.scrollTo({ y, animated: false });
  }, [selectedDay.toDateString()]);

  const createEvent = useMutation({
    mutationFn: (f: EventForm) => {
      const [sh, sm] = f.startTime.split(':').map(Number);
      const [eh, em] = f.endTime.split(':').map(Number);
      const start = new Date(f.date); start.setHours(sh, sm, 0, 0);
      const end = new Date(f.date); end.setHours(eh, em, 0, 0);
      return eventsApi.create({
        title: f.title.trim(),
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['quests'] });
      setEventForm(null);
    },
    onError: (e: any) => Alert.alert('Ops', e.message ?? 'Falha'),
  });

  const removeEvent = useMutation({
    mutationFn: (id: string) => eventsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['quests'] });
    },
  });

  const completeQuest = useMutation({
    mutationFn: (id: string) => questsApi.done(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }),
  });

  const undoQuest = useMutation({
    mutationFn: (id: string) => questsApi.undo(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }),
  });

  function openEventFormForHour(hour: number) {
    setEventForm({
      date: new Date(selectedDay),
      title: '',
      startTime: `${pad2(hour)}:00`,
      endTime: `${pad2(Math.min(hour + 1, 23))}:00`,
    });
  }

  function onItemTap(item: TimelineItem) {
    if (item.kind === 'event') {
      Alert.alert(item.title, 'Excluir esse evento?', [
        { text: 'Voltar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => removeEvent.mutate(item.id) },
      ]);
      return;
    }
    if (item.kind === 'quest') {
      if (item.status === 'pending') completeQuest.mutate(item.id);
      else undoQuest.mutate(item.id);
    }
  }

  const isToday = sameDay(selectedDay, now);
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() - HOURS_START * 60 : -1;
  const monthLabel = weekStart.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Agenda</Text>
          <Text style={s.monthLabel}>{monthLabel}</Text>
        </View>
        <View style={s.headerActions}>
          <Pressable
            style={s.iconBtn}
            onPress={() => {
              const next = weekOffset - 1;
              setWeekOffset(next);
              setSelectedDay(addDays(baseWeekStart, next * 7));
            }}
          >
            <Feather name="chevron-left" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            style={s.todayBtn}
            onPress={() => { setWeekOffset(0); setSelectedDay(new Date()); }}
          >
            <Text style={s.todayBtnText}>Hoje</Text>
          </Pressable>
          <Pressable
            style={s.iconBtn}
            onPress={() => {
              const next = weekOffset + 1;
              setWeekOffset(next);
              setSelectedDay(addDays(baseWeekStart, next * 7));
            }}
          >
            <Feather name="chevron-right" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={s.weekStrip}>
        {weekDays.map((d) => {
          const isSelected = sameDay(d, selectedDay);
          const isCurrentDay = sameDay(d, now);
          const wd = d.getDay() === 0 ? 6 : d.getDay() - 1;
          return (
            <Pressable key={d.toISOString()} onPress={() => setSelectedDay(d)} style={[s.dayPill, isSelected && s.dayPillActive]}>
              <Text style={[s.dayPillLabel, isSelected && s.dayPillLabelActive]}>{DAY_LABELS[wd]}</Text>
              <View style={[s.dayPillNumWrap, isCurrentDay && !isSelected && s.dayPillNumToday]}>
                <Text style={[s.dayPillNum, isSelected && s.dayPillNumActive, isCurrentDay && !isSelected && s.dayPillNumTodayText]}>
                  {d.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {dayStats.questsTotal + dayStats.events > 0 && (
        <View style={s.statsBar}>
          <View style={s.stat}>
            <Feather name="zap" size={14} color={colors.primaryDark} />
            <Text style={s.statText}>{dayStats.questsDone}/{dayStats.questsTotal} quests</Text>
          </View>
          {dayStats.events > 0 && (
            <View style={s.stat}>
              <Feather name="star" size={14} color={colors.infoDark} />
              <Text style={s.statText}>{dayStats.events} {dayStats.events === 1 ? 'evento' : 'eventos'}</Text>
            </View>
          )}
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        contentContainerStyle={{ paddingBottom: spacing.xxl + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {dayItems.length === 0 && (
          <View style={s.emptyHint}>
            <Feather name="sun" size={18} color={colors.textMuted} />
            <Text style={s.emptyHintText}>Dia livre. Toca no + abaixo pra criar evento.</Text>
          </View>
        )}

        <View style={s.timeline}>
          {Array.from({ length: HOURS_RANGE + 1 }, (_, i) => {
            const hour = HOURS_START + i;
            const isPeriodBoundary = hour === 12 || hour === 18;
            return (
              <View key={`line-${i}`}>
                <Text style={[s.hourLabel, { top: i * HOUR_HEIGHT - 8 }]}>{pad2(hour)}</Text>
                <View style={[s.hourLine, { top: i * HOUR_HEIGHT }, isPeriodBoundary && s.hourLineStrong]} />
              </View>
            );
          })}

          {/* Items */}
          {dayItems.map((it) => {
            const top = (it.startMin / 60) * HOUR_HEIGHT;
            const height = Math.max(((it.endMin - it.startMin) / 60) * HOUR_HEIGHT - 2, 32);
            return (
              <Pressable
                key={`${it.kind}-${it.id}`}
                onPress={() => onItemTap(it)}
                style={[
                  s.itemBase,
                  { top, height },
                  it.kind === 'block' && s.itemBlock,
                  it.kind === 'event' && s.itemEvent,
                  it.kind === 'quest' && it.status === 'pending' && s.itemQuestPending,
                  it.kind === 'quest' && it.status === 'done' && s.itemQuestDone,
                  it.kind === 'quest' && it.status === 'skipped' && s.itemQuestSkipped,
                ]}
              >
                <View style={s.itemBar} />
                <View style={s.itemContent}>
                  <Text style={s.itemTitle} numberOfLines={1}>{it.title}</Text>
                  <Text style={s.itemTime}>
                    {pad2(Math.floor((it.startMin + HOURS_START * 60) / 60))}:{pad2((it.startMin + HOURS_START * 60) % 60)}
                    {' – '}
                    {pad2(Math.floor((it.endMin + HOURS_START * 60) / 60))}:{pad2((it.endMin + HOURS_START * 60) % 60)}
                  </Text>
                </View>
                {it.kind === 'quest' && (
                  <Feather
                    name={it.status === 'done' ? 'check-circle' : it.status === 'skipped' ? 'x-circle' : 'circle'}
                    size={16}
                    color={it.status === 'done' ? colors.primary : it.status === 'skipped' ? colors.danger : colors.borderStrong}
                  />
                )}
              </Pressable>
            );
          })}

          {/* Now indicator */}
          {isToday && nowMin >= 0 && nowMin <= HOURS_RANGE * 60 && (
            <View style={[s.nowLine, { top: (nowMin / 60) * HOUR_HEIGHT }]}>
              <View style={s.nowDot} />
              <View style={s.nowBar} />
            </View>
          )}
        </View>
      </ScrollView>

      <Pressable
        style={s.fab}
        onPress={() => openEventFormForHour(now.getHours() < HOURS_END - 1 ? now.getHours() : 9)}
      >
        <Feather name="plus" size={26} color={colors.textInverse} />
      </Pressable>

      <Modal visible={eventForm !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEventForm(null)}>
        {eventForm && (
          <SafeAreaView style={s.modal} edges={['top', 'bottom']}>
            <View style={s.modalHeader}>
              <Pressable onPress={() => setEventForm(null)}><Feather name="x" size={26} color={colors.text} /></Pressable>
              <Text style={s.modalTitle}>Novo evento</Text>
              <View style={{ width: 26 }} />
            </View>
            <View style={s.modalBody}>
              <Text style={s.modalDate}>
                {eventForm.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </Text>
              <Input
                placeholder="Título (ex: Reunião)"
                value={eventForm.title}
                onChangeText={(v) => setEventForm({ ...eventForm, title: v })}
              />
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Início</Text>
                  <Input value={eventForm.startTime} onChangeText={(v) => setEventForm({ ...eventForm, startTime: v })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Fim</Text>
                  <Input value={eventForm.endTime} onChangeText={(v) => setEventForm({ ...eventForm, endTime: v })} />
                </View>
              </View>
            </View>
            <View style={s.modalFooter}>
              <Button label="Salvar evento" onPress={() => createEvent.mutate(eventForm)} loading={createEvent.isPending} />
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

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  title: { fontSize: font.size.xxl, fontWeight: font.weight.heavy, color: colors.text },
  monthLabel: { fontSize: font.size.xs, color: colors.textMuted, fontWeight: font.weight.bold, textTransform: 'capitalize', marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconBtn: { width: 32, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgMuted },
  todayBtn: { paddingHorizontal: spacing.md, height: 32, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: colors.bgMuted, borderWidth: 2, borderColor: colors.border },
  todayBtnText: { fontSize: font.size.sm, fontWeight: font.weight.heavy, color: colors.text },

  weekStrip: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: 4 },
  dayPill: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: 'transparent' },
  dayPillActive: { backgroundColor: colors.surfaceInvert },
  dayPillLabel: { fontSize: 10, fontWeight: font.weight.bold, color: colors.textMuted, textTransform: 'uppercase' },
  dayPillLabelActive: { color: colors.bg },
  dayPillNumWrap: { width: 30, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  dayPillNumToday: { backgroundColor: colors.primary },
  dayPillNum: { fontSize: font.size.lg, fontWeight: font.weight.heavy, color: colors.text },
  dayPillNumActive: { color: colors.bg },
  dayPillNumTodayText: { color: colors.textInverse },

  statsBar: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: colors.bgMuted, borderRadius: radius.pill },
  statText: { fontSize: font.size.xs, fontWeight: font.weight.bold, color: colors.text },

  scroll: { flex: 1 },
  emptyHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, backgroundColor: colors.bgMuted, marginHorizontal: spacing.xl, marginBottom: spacing.sm, borderRadius: radius.md },
  emptyHintText: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.weight.regular, flex: 1 },

  timeline: { height: DAY_HEIGHT + HOUR_HEIGHT, paddingHorizontal: spacing.lg, paddingTop: 16, position: 'relative' },

  hourLabel: {
    position: 'absolute',
    left: 0,
    width: TIME_COL_WIDTH,
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: font.weight.bold,
  },
  hourLine: {
    position: 'absolute',
    left: TIME_COL_WIDTH,
    right: 0,
    height: 1,
    backgroundColor: colors.border,
  },
  hourLineStrong: { backgroundColor: colors.borderStrong },

  itemBase: {
    position: 'absolute',
    left: TIME_COL_WIDTH + 4,
    right: 4,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.sm,
    overflow: 'hidden',
  },
  itemBlock: { backgroundColor: colors.bgMuted, borderWidth: 1.5, borderColor: colors.borderStrong },
  itemEvent: { backgroundColor: colors.eventBg, borderWidth: 1.5, borderColor: colors.info },
  itemQuestPending: { backgroundColor: colors.done, borderWidth: 1.5, borderColor: colors.primary },
  itemQuestDone: { backgroundColor: colors.bgMuted, borderWidth: 1.5, borderColor: colors.border, opacity: 0.7 },
  itemQuestSkipped: { backgroundColor: colors.skipped, borderWidth: 1.5, borderColor: colors.danger, opacity: 0.7 },
  itemBar: { width: 4, alignSelf: 'stretch', backgroundColor: 'transparent' },
  itemContent: { flex: 1, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  itemTitle: { fontSize: font.size.sm, fontWeight: font.weight.heavy, color: colors.text },
  itemTime: { fontSize: 10, color: colors.textMuted, fontWeight: font.weight.bold, marginTop: 1 },

  nowLine: { position: 'absolute', left: TIME_COL_WIDTH - 4, right: 0, flexDirection: 'row', alignItems: 'center' },
  nowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  nowBar: { flex: 1, height: 2, backgroundColor: colors.danger },

  fab: {
    position: 'absolute', right: spacing.xl, bottom: spacing.xl,
    width: 52, height: 52, borderRadius: radius.pill,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primaryDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 6,
  },

  modal: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: 2, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: font.size.lg, fontWeight: font.weight.heavy, color: colors.text },
  modalBody: { padding: spacing.xl, gap: spacing.md, flex: 1 },
  modalDate: { fontSize: font.size.md, color: colors.textMuted, fontWeight: font.weight.bold, textTransform: 'capitalize' },
  modalFooter: { padding: spacing.xl, paddingTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  label: { fontSize: font.size.sm, color: colors.textMuted, fontWeight: font.weight.bold, marginBottom: spacing.xs },
  });
}
