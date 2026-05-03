CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    timezone      text NOT NULL DEFAULT 'America/Sao_Paulo',
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE blocks (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       text NOT NULL,
    weekdays   smallint[] NOT NULL,
    start_time time NOT NULL,
    end_time   time NOT NULL,
    CHECK (start_time < end_time)
);

CREATE INDEX blocks_user_id_idx ON blocks(user_id);

CREATE TABLE goals (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           text NOT NULL,
    weekly_target   smallint NOT NULL CHECK (weekly_target > 0 AND weekly_target <= 21),
    session_minutes smallint NOT NULL CHECK (session_minutes > 0 AND session_minutes <= 480),
    github_repo     text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    archived_at     timestamptz
);

CREATE INDEX goals_user_id_idx ON goals(user_id) WHERE archived_at IS NULL;
CREATE INDEX goals_github_repo_idx ON goals(github_repo) WHERE github_repo IS NOT NULL AND archived_at IS NULL;

CREATE TABLE quests (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id       uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_for timestamptz NOT NULL,
    status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
    done_at       timestamptz
);

CREATE INDEX quests_user_scheduled_idx ON quests(user_id, scheduled_for);
CREATE INDEX quests_goal_status_idx ON quests(goal_id, status);

CREATE TABLE streaks (
    goal_id    uuid PRIMARY KEY REFERENCES goals(id) ON DELETE CASCADE,
    current    smallint NOT NULL DEFAULT 0,
    best       smallint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE integrations (
    user_id                uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    github_login           text,
    github_token_encrypted bytea
);

CREATE UNIQUE INDEX integrations_github_login_idx ON integrations(github_login) WHERE github_login IS NOT NULL;

CREATE TABLE skip_days (
    user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skip_day date NOT NULL,
    PRIMARY KEY (user_id, skip_day)
);
