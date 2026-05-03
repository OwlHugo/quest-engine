export type UUID = string;

export type User = {
  id: UUID;
  email: string;
  timezone: string;
  created_at: string;
};

export type Block = {
  id: UUID;
  user_id: UUID;
  name: string;
  weekdays: number[];
  start_time: string;
  end_time: string;
};

export type Goal = {
  id: UUID;
  user_id: UUID;
  title: string;
  weekly_target: number;
  session_minutes: number;
  github_repo: string | null;
  created_at: string;
  archived_at: string | null;
};

export type QuestStatus = 'pending' | 'done' | 'skipped';

export type Quest = {
  id: UUID;
  goal_id: UUID;
  user_id: UUID;
  scheduled_for: string;
  status: QuestStatus;
  done_at: string | null;
};

export type Event = {
  id: UUID;
  title: string;
  starts_at: string;
  ends_at: string;
};
