package http

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/hugoadriano/quest-engine/internal/auth"
	gh "github.com/hugoadriano/quest-engine/internal/github"
	"github.com/hugoadriano/quest-engine/internal/store"
)

type connectGitHubReq struct {
	Login       string `json:"login"`
	AccessToken string `json:"access_token"`
}

func (s *Server) connectGitHub(w http.ResponseWriter, r *http.Request) {
	var req connectGitHubReq
	if err := decode(r, &req); err != nil || req.AccessToken == "" || req.Login == "" {
		writeErr(w, http.StatusBadRequest, "login and access_token required")
		return
	}
	enc, err := gh.Encrypt([]byte(s.cfg.EncryptionKey), req.AccessToken)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "encrypt failed")
		return
	}
	if err := s.q.SetGitHubIntegration(r.Context(), store.SetGitHubIntegrationParams{
		UserID:               auth.UserID(r.Context()),
		GithubLogin:          &req.Login,
		GithubTokenEncrypted: enc,
	}); err != nil {
		writeErr(w, http.StatusConflict, "github login already linked to another account")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) disconnectGitHub(w http.ResponseWriter, r *http.Request) {
	if err := s.q.ClearGitHubIntegration(r.Context(), auth.UserID(r.Context())); err != nil {
		writeErr(w, http.StatusInternalServerError, "clear failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

type pushPayload struct {
	Repository struct {
		FullName string `json:"full_name"`
	} `json:"repository"`
	Sender struct {
		Login string `json:"login"`
	} `json:"sender"`
}

func (s *Server) githubWebhook(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "read failed")
		return
	}
	if !gh.VerifySignature(s.cfg.GitHubWebhookSecret, r.Header.Get("X-Hub-Signature-256"), body) {
		writeErr(w, http.StatusUnauthorized, "invalid signature")
		return
	}
	if r.Header.Get("X-GitHub-Event") != "push" {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	var p pushPayload
	if err := json.Unmarshal(body, &p); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid payload")
		return
	}

	userID, err := s.q.GetUserIDByGitHubLogin(r.Context(), &p.Sender.Login)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		writeErr(w, http.StatusInternalServerError, "lookup failed")
		return
	}

	loc := time.UTC
	if u, err := s.q.GetUserByID(r.Context(), userID); err == nil {
		if l, err := time.LoadLocation(u.Timezone); err == nil {
			loc = l
		}
	}
	now := time.Now().In(loc)
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	dayEnd := dayStart.AddDate(0, 0, 1)

	_, err = s.q.CompleteFirstPendingQuestByRepo(r.Context(), store.CompleteFirstPendingQuestByRepoParams{
		UserID:         userID,
		ScheduledFor:   pgtype.Timestamptz{Time: dayStart, Valid: true},
		ScheduledFor_2: pgtype.Timestamptz{Time: dayEnd, Valid: true},
		GithubRepo:     &p.Repository.FullName,
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		writeErr(w, http.StatusInternalServerError, "update failed")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
