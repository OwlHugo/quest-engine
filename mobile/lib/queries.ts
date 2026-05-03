import { api } from './api';
import type { Block, Goal, Quest, Event } from './types';

export const blocksApi = {
  list: () => api<Block[]>('GET', '/blocks'),
  create: (b: Omit<Block, 'id' | 'user_id'>) => api<Block>('POST', '/blocks', b),
  update: (id: string, b: Omit<Block, 'id' | 'user_id'>) =>
    api<Block>('PATCH', `/blocks/${id}`, b),
  remove: (id: string) => api('DELETE', `/blocks/${id}`),
};

export const goalsApi = {
  list: () => api<Goal[]>('GET', '/goals'),
  create: (g: { title: string; weekly_target: number; session_minutes: number }) =>
    api<Goal>('POST', '/goals', g),
  update: (id: string, g: { title: string; weekly_target: number; session_minutes: number }) =>
    api<Goal>('PATCH', `/goals/${id}`, g),
  archive: (id: string) => api('DELETE', `/goals/${id}`),
};

export const eventsApi = {
  list: (week: 'current' | 'next' = 'current') =>
    api<Event[]>('GET', `/events?week=${week}`),
  create: (e: { title: string; starts_at: string; ends_at: string }) =>
    api<Event>('POST', '/events', e),
  remove: (id: string) => api('DELETE', `/events/${id}`),
};

export const questsApi = {
  list: (week: 'current' | 'next' = 'current') =>
    api<Quest[]>('GET', `/quests?week=${week}`),
  done: (id: string) => api<Quest>('POST', `/quests/${id}/done`),
  undo: (id: string) => api<Quest>('POST', `/quests/${id}/undo`),
  skipToday: () => api('POST', '/quests/skip-today'),
};
