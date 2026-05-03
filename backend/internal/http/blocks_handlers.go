package http

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/hugoadriano/quest-engine/internal/auth"
	"github.com/hugoadriano/quest-engine/internal/store"
)

type blockReq struct {
	Name      string `json:"name"`
	Weekdays  []int16 `json:"weekdays"`
	StartTime string `json:"start_time"` // "HH:MM"
	EndTime   string `json:"end_time"`
}

func parseTime(s string) (pgtype.Time, error) {
	var t pgtype.Time
	err := t.Scan(s + ":00")
	return t, err
}

func (s *Server) listBlocks(w http.ResponseWriter, r *http.Request) {
	rows, err := s.q.ListBlocks(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "list failed")
		return
	}
	writeJSON(w, http.StatusOK, toBlockDTOs(rows))
}

func (s *Server) createBlock(w http.ResponseWriter, r *http.Request) {
	var req blockReq
	if err := decode(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	start, err := parseTime(req.StartTime)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid start_time")
		return
	}
	end, err := parseTime(req.EndTime)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid end_time")
		return
	}
	b, err := s.q.CreateBlock(r.Context(), store.CreateBlockParams{
		UserID:    auth.UserID(r.Context()),
		Name:      req.Name,
		Weekdays:  req.Weekdays,
		StartTime: start,
		EndTime:   end,
	})
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = s.sch.EnsureCurrentWeek(r.Context(), auth.UserID(r.Context()))
	writeJSON(w, http.StatusCreated, toBlockDTO(b))
}

func (s *Server) updateBlock(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(urlID(r))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req blockReq
	if err := decode(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	start, err := parseTime(req.StartTime)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid start_time")
		return
	}
	end, err := parseTime(req.EndTime)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid end_time")
		return
	}
	b, err := s.q.UpdateBlock(r.Context(), store.UpdateBlockParams{
		ID:        id,
		Name:      req.Name,
		Weekdays:  req.Weekdays,
		StartTime: start,
		EndTime:   end,
		UserID:    auth.UserID(r.Context()),
	})
	if err != nil {
		writeErr(w, http.StatusNotFound, "block not found")
		return
	}
	writeJSON(w, http.StatusOK, toBlockDTO(b))
}

func (s *Server) deleteBlock(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(urlID(r))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := s.q.DeleteBlock(r.Context(), store.DeleteBlockParams{
		ID:     id,
		UserID: auth.UserID(r.Context()),
	}); err != nil {
		writeErr(w, http.StatusInternalServerError, "delete failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
