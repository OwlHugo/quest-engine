-- name: CreateUser :one
INSERT INTO users (email, password_hash, timezone)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: ListBlocks :many
SELECT * FROM blocks WHERE user_id = $1 ORDER BY start_time;

-- name: CreateBlock :one
INSERT INTO blocks (user_id, name, weekdays, start_time, end_time)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateBlock :one
UPDATE blocks
SET name = $2, weekdays = $3, start_time = $4, end_time = $5
WHERE id = $1 AND user_id = $6
RETURNING *;

-- name: DeleteBlock :exec
DELETE FROM blocks WHERE id = $1 AND user_id = $2;

-- name: ListGoals :many
SELECT * FROM goals
WHERE user_id = $1 AND archived_at IS NULL
ORDER BY created_at;

-- name: ListUserIDsWithActiveGoals :many
SELECT DISTINCT user_id FROM goals WHERE archived_at IS NULL;

-- name: ListGoalsForUser :many
SELECT * FROM goals WHERE user_id = $1 AND archived_at IS NULL;

-- name: CountDoneQuestsForGoalBetween :one
SELECT COUNT(*) FROM quests
WHERE goal_id = $1 AND status = 'done'
  AND scheduled_for >= $2 AND scheduled_for < $3;

-- name: CreateGoal :one
INSERT INTO goals (user_id, title, weekly_target, session_minutes, github_repo)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: UpdateGoal :one
UPDATE goals
SET title = $2, weekly_target = $3, session_minutes = $4, github_repo = $5
WHERE id = $1 AND user_id = $6 AND archived_at IS NULL
RETURNING *;

-- name: ArchiveGoal :exec
UPDATE goals SET archived_at = now() WHERE id = $1 AND user_id = $2;

-- name: DeletePendingQuestsByGoal :exec
DELETE FROM quests WHERE goal_id = $1 AND status = 'pending';

-- name: FindGoalByRepo :one
SELECT * FROM goals
WHERE user_id = $1 AND github_repo = $2 AND archived_at IS NULL
LIMIT 1;

-- name: ListQuestsBetween :many
SELECT * FROM quests
WHERE user_id = $1 AND scheduled_for >= $2 AND scheduled_for < $3
ORDER BY scheduled_for;

-- name: ListPendingQuestsForGoalOnDate :many
SELECT * FROM quests
WHERE goal_id = $1
  AND status = 'pending'
  AND scheduled_for >= $2
  AND scheduled_for < $3
ORDER BY scheduled_for;

-- name: CreateQuest :one
INSERT INTO quests (goal_id, user_id, scheduled_for)
VALUES ($1, $2, $3)
RETURNING *;

-- name: MarkQuestDone :one
UPDATE quests
SET status = 'done', done_at = now()
WHERE id = $1 AND user_id = $2 AND status = 'pending'
RETURNING *;

-- name: UndoQuest :one
UPDATE quests
SET status = 'pending', done_at = NULL
WHERE id = $1 AND user_id = $2 AND status IN ('done', 'skipped')
RETURNING *;

-- name: DeletePendingQuestByID :exec
DELETE FROM quests WHERE id = $1 AND status = 'pending';

-- name: SkipPendingQuestsOnDate :exec
UPDATE quests
SET status = 'skipped'
WHERE user_id = $1
  AND status = 'pending'
  AND scheduled_for >= $2
  AND scheduled_for < $3;

-- name: GetStreak :one
SELECT * FROM streaks WHERE goal_id = $1;

-- name: UpsertStreak :one
INSERT INTO streaks (goal_id, current, best, updated_at)
VALUES ($1, $2, $3, now())
ON CONFLICT (goal_id) DO UPDATE
SET current = EXCLUDED.current,
    best = GREATEST(streaks.best, EXCLUDED.best),
    updated_at = now()
RETURNING *;

-- name: SetGitHubIntegration :exec
INSERT INTO integrations (user_id, github_login, github_token_encrypted)
VALUES ($1, $2, $3)
ON CONFLICT (user_id) DO UPDATE
SET github_login = EXCLUDED.github_login,
    github_token_encrypted = EXCLUDED.github_token_encrypted;

-- name: ClearGitHubIntegration :exec
UPDATE integrations SET github_login = NULL, github_token_encrypted = NULL WHERE user_id = $1;

-- name: GetUserIDByGitHubLogin :one
SELECT user_id FROM integrations WHERE github_login = $1;

-- name: CompleteFirstPendingQuestByRepo :one
UPDATE quests
SET status = 'done', done_at = now()
WHERE id = (
    SELECT q.id FROM quests q
    JOIN goals g ON g.id = q.goal_id
    WHERE q.user_id = $1
      AND q.status = 'pending'
      AND q.scheduled_for >= $2
      AND q.scheduled_for < $3
      AND g.github_repo = $4
    ORDER BY q.scheduled_for
    LIMIT 1
)
RETURNING *;

-- name: ListEventsBetween :many
SELECT * FROM events
WHERE user_id = @user_id
  AND starts_at < @range_end
  AND ends_at > @range_start
ORDER BY starts_at;

-- name: CreateEvent :one
INSERT INTO events (user_id, title, starts_at, ends_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: DeleteEvent :exec
DELETE FROM events WHERE id = $1 AND user_id = $2;

-- name: AddSkipDay :exec
INSERT INTO skip_days (user_id, skip_day)
VALUES ($1, $2)
ON CONFLICT DO NOTHING;

-- name: CountSkipDaysInWeek :one
SELECT COUNT(*) FROM skip_days
WHERE user_id = $1 AND skip_day >= $2 AND skip_day < $3;
