package http

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/hugoadriano/quest-engine/internal/auth"
	"github.com/hugoadriano/quest-engine/internal/config"
	"github.com/hugoadriano/quest-engine/internal/scheduler"
	"github.com/hugoadriano/quest-engine/internal/store"
)

type Server struct {
	cfg *config.Config
	q   *store.Queries
	sch *scheduler.Scheduler
}

func NewServer(cfg *config.Config, q *store.Queries, sch *scheduler.Scheduler) *Server {
	return &Server{cfg: cfg, q: q, sch: sch}
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(15 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
	}))

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte("ok"))
	})

	r.Post("/auth/register", s.register)
	r.Post("/auth/login", s.login)
	r.Post("/webhooks/github", s.githubWebhook)

	r.Group(func(r chi.Router) {
		r.Use(auth.Middleware(s.cfg.JWTSecret))

		r.Get("/me", s.me)

		r.Get("/blocks", s.listBlocks)
		r.Post("/blocks", s.createBlock)
		r.Patch("/blocks/{id}", s.updateBlock)
		r.Delete("/blocks/{id}", s.deleteBlock)

		r.Get("/goals", s.listGoals)
		r.Post("/goals", s.createGoal)
		r.Patch("/goals/{id}", s.updateGoal)
		r.Delete("/goals/{id}", s.archiveGoal)

		r.Get("/events", s.listEvents)
		r.Post("/events", s.createEvent)
		r.Delete("/events/{id}", s.deleteEvent)

		r.Get("/quests", s.listQuests)
		r.Post("/quests/{id}/done", s.markQuestDone)
		r.Post("/quests/{id}/undo", s.undoQuest)
		r.Post("/quests/skip-today", s.skipToday)
		r.Post("/quests/regenerate", s.regenerateWeek)

		r.Post("/integrations/github", s.connectGitHub)
		r.Delete("/integrations/github", s.disconnectGitHub)
	})

	return r
}
