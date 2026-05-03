package http

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/hugoadriano/quest-engine/internal/auth"
	"github.com/hugoadriano/quest-engine/internal/store"
)

type goalReq struct {
	Title          string  `json:"title"`
	WeeklyTarget   int16   `json:"weekly_target"`
	SessionMinutes int16   `json:"session_minutes"`
	GitHubRepo     *string `json:"github_repo,omitempty"`
}

func (s *Server) listGoals(w http.ResponseWriter, r *http.Request) {
	rows, err := s.q.ListGoals(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "list failed")
		return
	}
	writeJSON(w, http.StatusOK, toGoalDTOs(rows))
}

func (s *Server) createGoal(w http.ResponseWriter, r *http.Request) {
	var req goalReq
	if err := decode(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	g, err := s.q.CreateGoal(r.Context(), store.CreateGoalParams{
		UserID:         auth.UserID(r.Context()),
		Title:          req.Title,
		WeeklyTarget:   req.WeeklyTarget,
		SessionMinutes: req.SessionMinutes,
		GithubRepo:     req.GitHubRepo,
	})
	if err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	_ = s.sch.EnsureCurrentWeek(r.Context(), auth.UserID(r.Context()))
	writeJSON(w, http.StatusCreated, toGoalDTO(g))
}

func (s *Server) updateGoal(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(urlID(r))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	var req goalReq
	if err := decode(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	g, err := s.q.UpdateGoal(r.Context(), store.UpdateGoalParams{
		ID:             id,
		Title:          req.Title,
		WeeklyTarget:   req.WeeklyTarget,
		SessionMinutes: req.SessionMinutes,
		GithubRepo:     req.GitHubRepo,
		UserID:         auth.UserID(r.Context()),
	})
	if err != nil {
		writeErr(w, http.StatusNotFound, "goal not found")
		return
	}
	writeJSON(w, http.StatusOK, toGoalDTO(g))
}

func (s *Server) archiveGoal(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(urlID(r))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	if err := s.q.ArchiveGoal(r.Context(), store.ArchiveGoalParams{
		ID:     id,
		UserID: auth.UserID(r.Context()),
	}); err != nil {
		writeErr(w, http.StatusInternalServerError, "archive failed")
		return
	}
	if err := s.q.DeletePendingQuestsByGoal(r.Context(), id); err != nil {
		writeErr(w, http.StatusInternalServerError, "cleanup failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
