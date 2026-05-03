package http

import (
	"context"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/hugoadriano/quest-engine/internal/auth"
	"github.com/hugoadriano/quest-engine/internal/store"
)

func (s *Server) listQuests(w http.ResponseWriter, r *http.Request) {
	loc, _ := userLocation(r.Context(), s)
	from, to := weekRange(time.Now().In(loc))

	if w := r.URL.Query().Get("week"); w == "next" {
		from, to = from.AddDate(0, 0, 7), to.AddDate(0, 0, 7)
	}

	rows, err := s.q.ListQuestsBetween(r.Context(), store.ListQuestsBetweenParams{
		UserID:        auth.UserID(r.Context()),
		ScheduledFor:   pgtype.Timestamptz{Time: from, Valid: true},
		ScheduledFor_2: pgtype.Timestamptz{Time: to, Valid: true},
	})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "list failed")
		return
	}
	writeJSON(w, http.StatusOK, toQuestDTOs(rows))
}

func (s *Server) markQuestDone(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(urlID(r))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	q, err := s.q.MarkQuestDone(r.Context(), store.MarkQuestDoneParams{
		ID:     id,
		UserID: auth.UserID(r.Context()),
	})
	if err != nil {
		writeErr(w, http.StatusNotFound, "quest not pending or not found")
		return
	}
	writeJSON(w, http.StatusOK, toQuestDTO(q))
}

func (s *Server) undoQuest(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(urlID(r))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	q, err := s.q.UndoQuest(r.Context(), store.UndoQuestParams{
		ID:     id,
		UserID: auth.UserID(r.Context()),
	})
	if err != nil {
		writeErr(w, http.StatusNotFound, "quest not done/skipped or not found")
		return
	}
	writeJSON(w, http.StatusOK, toQuestDTO(q))
}

func (s *Server) skipToday(w http.ResponseWriter, r *http.Request) {
	loc, _ := userLocation(r.Context(), s)
	now := time.Now().In(loc)
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	dayEnd := dayStart.AddDate(0, 0, 1)
	weekStart, _ := weekRange(now)

	count, err := s.q.CountSkipDaysInWeek(r.Context(), store.CountSkipDaysInWeekParams{
		UserID:    auth.UserID(r.Context()),
		SkipDay:   pgtype.Date{Time: weekStart, Valid: true},
		SkipDay_2: pgtype.Date{Time: weekStart.AddDate(0, 0, 7), Valid: true},
	})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "check failed")
		return
	}
	if count >= 1 {
		writeErr(w, http.StatusForbidden, "already used skip this week")
		return
	}

	if err := s.q.AddSkipDay(r.Context(), store.AddSkipDayParams{
		UserID:  auth.UserID(r.Context()),
		SkipDay: pgtype.Date{Time: dayStart, Valid: true},
	}); err != nil {
		writeErr(w, http.StatusInternalServerError, "skip failed")
		return
	}
	if err := s.q.SkipPendingQuestsOnDate(r.Context(), store.SkipPendingQuestsOnDateParams{
		UserID:        auth.UserID(r.Context()),
		ScheduledFor:   pgtype.Timestamptz{Time: dayStart, Valid: true},
		ScheduledFor_2: pgtype.Timestamptz{Time: dayEnd, Valid: true},
	}); err != nil {
		writeErr(w, http.StatusInternalServerError, "skip failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func userLocation(ctx context.Context, s *Server) (*time.Location, error) {
	u, err := s.q.GetUserByID(ctx, auth.UserID(ctx))
	if err != nil {
		return time.UTC, err
	}
	loc, err := time.LoadLocation(u.Timezone)
	if err != nil {
		return time.UTC, err
	}
	return loc, nil
}

func (s *Server) regenerateWeek(w http.ResponseWriter, r *http.Request) {
	if err := s.sch.EnsureCurrentWeek(r.Context(), auth.UserID(r.Context())); err != nil {
		writeErr(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// weekRange returns Monday 00:00 (inclusive) to next Monday 00:00 (exclusive).
func weekRange(now time.Time) (time.Time, time.Time) {
	wd := int(now.Weekday())
	if wd == 0 {
		wd = 7
	}
	start := time.Date(now.Year(), now.Month(), now.Day()-wd+1, 0, 0, 0, 0, now.Location())
	return start, start.AddDate(0, 0, 7)
}
