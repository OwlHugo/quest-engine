package scheduler

import (
	"context"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/hugoadriano/quest-engine/internal/store"
)

// RunWeeklyForUser plans + persists next week's quests for one user, and
// updates streaks based on the past week's completion.
func (s *Scheduler) RunWeeklyForUser(ctx context.Context, userID uuid.UUID) error {
	user, err := s.q.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	loc, err := time.LoadLocation(user.Timezone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)

	blocks, err := s.q.ListBlocks(ctx, userID)
	if err != nil {
		return err
	}
	goals, err := s.q.ListGoalsForUser(ctx, userID)
	if err != nil {
		return err
	}

	if err := s.updateStreaks(ctx, now, loc, goals); err != nil {
		slog.Error("update streaks", "user", userID, "err", err)
	}

	plan := PlanWeek(now, loc, blocks, goals)
	for _, p := range plan {
		if _, err := s.q.CreateQuest(ctx, store.CreateQuestParams{
			GoalID:       p.GoalID,
			UserID:       userID,
			ScheduledFor: pgtype.Timestamptz{Time: p.Start, Valid: true},
		}); err != nil {
			slog.Error("create quest", "err", err)
		}
	}
	return nil
}

// RunWeeklyAll iterates all users with active goals and runs RunWeeklyForUser.
func (s *Scheduler) RunWeeklyAll(ctx context.Context) {
	users, err := s.q.ListUserIDsWithActiveGoals(ctx)
	if err != nil {
		slog.Error("list users", "err", err)
		return
	}
	for _, u := range users {
		if err := s.RunWeeklyForUser(ctx, u); err != nil {
			slog.Error("weekly user failed", "user", u, "err", err)
		}
	}
}

func (s *Scheduler) updateStreaks(ctx context.Context, now time.Time, loc *time.Location, goals []store.Goal) error {
	weekStart, weekEnd := lastWeekRange(now, loc)
	for _, g := range goals {
		count, err := s.q.CountDoneQuestsForGoalBetween(ctx, store.CountDoneQuestsForGoalBetweenParams{
			GoalID:         g.ID,
			ScheduledFor:   pgtype.Timestamptz{Time: weekStart, Valid: true},
			ScheduledFor_2: pgtype.Timestamptz{Time: weekEnd, Valid: true},
		})
		if err != nil {
			return err
		}
		prev, err := s.q.GetStreak(ctx, g.ID)
		current := int16(0)
		best := int16(0)
		if err == nil {
			current = prev.Current
			best = prev.Best
		}
		if int16(count) >= g.WeeklyTarget {
			current++
			if current > best {
				best = current
			}
		} else {
			current = 0
		}
		if _, err := s.q.UpsertStreak(ctx, store.UpsertStreakParams{
			GoalID:  g.ID,
			Current: current,
			Best:    best,
		}); err != nil {
			return err
		}
	}
	return nil
}

func lastWeekRange(now time.Time, loc *time.Location) (time.Time, time.Time) {
	wd := int(now.Weekday())
	if wd == 0 {
		wd = 7
	}
	thisMonday := time.Date(now.Year(), now.Month(), now.Day()-wd+1, 0, 0, 0, 0, loc)
	return thisMonday.AddDate(0, 0, -7), thisMonday
}
