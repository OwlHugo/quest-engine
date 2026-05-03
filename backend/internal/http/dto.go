package http

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/hugoadriano/quest-engine/internal/store"
)

type UserDTO struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Timezone  string    `json:"timezone"`
	CreatedAt string    `json:"created_at"`
}

type BlockDTO struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Weekdays  []int16   `json:"weekdays"`
	StartTime string    `json:"start_time"`
	EndTime   string    `json:"end_time"`
}

type GoalDTO struct {
	ID             uuid.UUID `json:"id"`
	Title          string    `json:"title"`
	WeeklyTarget   int16     `json:"weekly_target"`
	SessionMinutes int16     `json:"session_minutes"`
	GithubRepo     *string   `json:"github_repo"`
	CreatedAt      string    `json:"created_at"`
}

type QuestDTO struct {
	ID           uuid.UUID `json:"id"`
	GoalID       uuid.UUID `json:"goal_id"`
	ScheduledFor string    `json:"scheduled_for"`
	Status       string    `json:"status"`
	DoneAt       *string   `json:"done_at"`
}

type StreakDTO struct {
	GoalID  uuid.UUID `json:"goal_id"`
	Current int16     `json:"current"`
	Best    int16     `json:"best"`
}

type EventDTO struct {
	ID       uuid.UUID `json:"id"`
	Title    string    `json:"title"`
	StartsAt string    `json:"starts_at"`
	EndsAt   string    `json:"ends_at"`
}

func toEventDTO(e store.Event) EventDTO {
	return EventDTO{
		ID:       e.ID,
		Title:    e.Title,
		StartsAt: formatTimestamptz(e.StartsAt),
		EndsAt:   formatTimestamptz(e.EndsAt),
	}
}

func formatTime(t pgtype.Time) string {
	if !t.Valid {
		return ""
	}
	micros := t.Microseconds
	hh := micros / 3_600_000_000
	mm := (micros % 3_600_000_000) / 60_000_000
	return fmt.Sprintf("%02d:%02d", hh, mm)
}

func formatTimestamptz(t pgtype.Timestamptz) string {
	if !t.Valid {
		return ""
	}
	return t.Time.UTC().Format(time.RFC3339)
}

func formatTimestamptzPtr(t pgtype.Timestamptz) *string {
	if !t.Valid {
		return nil
	}
	s := t.Time.UTC().Format(time.RFC3339)
	return &s
}

func toUserDTO(u store.User) UserDTO {
	return UserDTO{
		ID:        u.ID,
		Email:     u.Email,
		Timezone:  u.Timezone,
		CreatedAt: formatTimestamptz(u.CreatedAt),
	}
}

func toBlockDTO(b store.Block) BlockDTO {
	return BlockDTO{
		ID:        b.ID,
		Name:      b.Name,
		Weekdays:  b.Weekdays,
		StartTime: formatTime(b.StartTime),
		EndTime:   formatTime(b.EndTime),
	}
}

func toBlockDTOs(bs []store.Block) []BlockDTO {
	out := make([]BlockDTO, len(bs))
	for i, b := range bs {
		out[i] = toBlockDTO(b)
	}
	return out
}

func toGoalDTO(g store.Goal) GoalDTO {
	return GoalDTO{
		ID:             g.ID,
		Title:          g.Title,
		WeeklyTarget:   g.WeeklyTarget,
		SessionMinutes: g.SessionMinutes,
		GithubRepo:     g.GithubRepo,
		CreatedAt:      formatTimestamptz(g.CreatedAt),
	}
}

func toGoalDTOs(gs []store.Goal) []GoalDTO {
	out := make([]GoalDTO, len(gs))
	for i, g := range gs {
		out[i] = toGoalDTO(g)
	}
	return out
}

func toQuestDTO(q store.Quest) QuestDTO {
	return QuestDTO{
		ID:           q.ID,
		GoalID:       q.GoalID,
		ScheduledFor: formatTimestamptz(q.ScheduledFor),
		Status:       q.Status,
		DoneAt:       formatTimestamptzPtr(q.DoneAt),
	}
}

func toQuestDTOs(qs []store.Quest) []QuestDTO {
	out := make([]QuestDTO, len(qs))
	for i, q := range qs {
		out[i] = toQuestDTO(q)
	}
	return out
}
