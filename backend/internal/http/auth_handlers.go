package http

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/hugoadriano/quest-engine/internal/auth"
	"github.com/hugoadriano/quest-engine/internal/store"
)

type registerReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Timezone string `json:"timezone"`
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := decode(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	if req.Email == "" || len(req.Password) < 8 {
		writeErr(w, http.StatusBadRequest, "email and password (min 8) required")
		return
	}
	tz := req.Timezone
	if tz == "" {
		tz = "America/Sao_Paulo"
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "hash failed")
		return
	}

	user, err := s.q.CreateUser(r.Context(), store.CreateUserParams{
		Email:        req.Email,
		PasswordHash: hash,
		Timezone:     tz,
	})
	if err != nil {
		writeErr(w, http.StatusConflict, "email already used")
		return
	}

	token, err := auth.Sign(s.cfg.JWTSecret, user.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "sign failed")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"token": token, "user": toUserDTO(user)})
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := decode(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid body")
		return
	}
	user, err := s.q.GetUserByEmail(r.Context(), req.Email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			writeErr(w, http.StatusUnauthorized, "invalid credentials")
			return
		}
		writeErr(w, http.StatusInternalServerError, "lookup failed")
		return
	}
	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		writeErr(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	token, err := auth.Sign(s.cfg.JWTSecret, user.ID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "sign failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": toUserDTO(user)})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	user, err := s.q.GetUserByID(r.Context(), auth.UserID(r.Context()))
	if err != nil {
		writeErr(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, toUserDTO(user))
}
