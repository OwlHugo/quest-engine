package http

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/hugoadriano/quest-engine/internal/auth"
	"github.com/hugoadriano/quest-engine/internal/store"
)

type eventReq struct {
	Title    string `json:"title"`
	StartsAt string `json:"starts_at"`
	EndsAt   string `json:"ends_at"`
}

func (s *Server) listEvents(w http.ResponseWriter, r *http.Request) {
	loc, _ := userLocation(r.Context(), s)
	from, to := weekRange(time.Now().In(loc))

	if w := r.URL.Query().Get("week"); w == "next" {
		from, to = from.AddDate(0, 0, 7), to.AddDate(0, 0, 7)
	}

	rows, err := s.q.ListEventsBetween(r.Context(), store.ListEventsBetweenParams{
		UserID:     auth.UserID(r.Context()),
		RangeStart: pgtype.Timestamptz{Time: from, Valid: true},
		RangeEnd:   pgtype.Timestamptz{Time: to, Valid: true},
	})
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "list failed")
		return
	}
	out := make([]EventDTO, len(rows))
	for i, e := range rows {
		out[i] = toEventDTO(e)
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) createEvent(w http.ResponseWriter, r *http.Request) {
	var req eventReq
	if err := decode(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	startsAt, err := time.Parse(time.RFC3339, req.StartsAt)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid starts_at (need RFC3339)")
		return
	}
	endsAt, err := time.Parse(time.RFC3339, req.EndsAt)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid ends_at (need RFC3339)")
		return
	}
	if !startsAt.Before(endsAt) {
		writeErr(w, http.StatusBadRequest, "starts_at must be before ends_at")
		return
	}
	e, err := s.q.CreateEvent(r.Context(), store.CreateEventParams{
		UserID:   auth.UserID(r.Context()),
		Title:    req.Title,
		StartsAt: pgtype.Timestamptz{Time: startsAt, Valid: true},
		EndsAt:   pgtype.Timestamptz{Time: endsAt, Valid: true},
	})
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = s.sch.EnsureCurrentWeek(r.Context(), auth.UserID(r.Context()))
	writeJSON(w, http.StatusCreated, toEventDTO(e))
}

func (s *Server) deleteEvent(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(urlID(r))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := s.q.DeleteEvent(r.Context(), store.DeleteEventParams{
		ID:     id,
		UserID: auth.UserID(r.Context()),
	}); err != nil {
		writeErr(w, http.StatusInternalServerError, "delete failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
