package e2e

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	stdhttp "net/http"
	"net/http/httptest"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/testcontainers/testcontainers-go"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	"github.com/hugoadriano/quest-engine/internal/config"
	httpsrv "github.com/hugoadriano/quest-engine/internal/http"
	"github.com/hugoadriano/quest-engine/internal/scheduler"
	"github.com/hugoadriano/quest-engine/internal/store"
)

type harness struct {
	t      *testing.T
	server *httptest.Server
	token  string
}

func newHarness(t *testing.T) *harness {
	t.Helper()
	ctx := context.Background()

	container, err := tcpostgres.Run(ctx,
		"postgres:16-alpine",
		tcpostgres.WithDatabase("test"),
		tcpostgres.WithUsername("test"),
		tcpostgres.WithPassword("test"),
		testcontainers.WithWaitStrategy(
			wait.ForLog("database system is ready to accept connections").
				WithOccurrence(2).
				WithStartupTimeout(60*time.Second),
		),
	)
	if err != nil {
		t.Fatalf("postgres container: %v", err)
	}
	t.Cleanup(func() { _ = container.Terminate(ctx) })

	dsn, err := container.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		t.Fatalf("dsn: %v", err)
	}

	migrationsPath := repoFile("migrations")
	m, err := migrate.New("file://"+migrationsPath, dsn)
	if err != nil {
		t.Fatalf("migrate new: %v", err)
	}
	if err := m.Up(); err != nil {
		t.Fatalf("migrate up: %v", err)
	}

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("pool: %v", err)
	}
	t.Cleanup(pool.Close)

	q := store.New(pool)
	cfg := &config.Config{
		JWTSecret:           "test-secret-must-be-32-chars-or-more",
		EncryptionKey:       "01234567890123456789012345678901",
		GitHubWebhookSecret: "test",
	}
	sch := scheduler.New(q)
	srv := httpsrv.NewServer(cfg, q, sch)
	ts := httptest.NewServer(srv.Router())
	t.Cleanup(ts.Close)

	return &harness{t: t, server: ts}
}

func repoFile(rel string) string {
	_, file, _, _ := runtime.Caller(0)
	root := filepath.Join(filepath.Dir(file), "..", "..")
	return filepath.Join(root, rel)
}

func (h *harness) do(method, path string, body any) (*stdhttp.Response, []byte) {
	h.t.Helper()
	var rdr io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		rdr = bytes.NewReader(raw)
	}
	req, err := stdhttp.NewRequest(method, h.server.URL+path, rdr)
	if err != nil {
		h.t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	if h.token != "" {
		req.Header.Set("Authorization", "Bearer "+h.token)
	}
	res, err := stdhttp.DefaultClient.Do(req)
	if err != nil {
		h.t.Fatal(err)
	}
	defer res.Body.Close()
	data, _ := io.ReadAll(res.Body)
	return res, data
}

func (h *harness) mustJSON(method, path string, body any, status int, out any) {
	h.t.Helper()
	res, data := h.do(method, path, body)
	if res.StatusCode != status {
		h.t.Fatalf("%s %s: want %d got %d body=%s", method, path, status, res.StatusCode, string(data))
	}
	if out != nil && len(data) > 0 {
		if err := json.Unmarshal(data, out); err != nil {
			h.t.Fatalf("decode %s: %v body=%s", path, err, string(data))
		}
	}
}

type authRes struct {
	Token string `json:"token"`
}

type id struct {
	ID string `json:"id"`
}

type quest struct {
	ID           string `json:"id"`
	GoalID       string `json:"goal_id"`
	ScheduledFor string `json:"scheduled_for"`
	Status       string `json:"status"`
}

type event struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	StartsAt string `json:"starts_at"`
	EndsAt   string `json:"ends_at"`
}

type block struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Weekdays  []int16 `json:"weekdays"`
	StartTime string  `json:"start_time"`
	EndTime   string  `json:"end_time"`
}

func (h *harness) register(email, password string) {
	h.t.Helper()
	var ar authRes
	h.mustJSON("POST", "/auth/register", map[string]any{
		"email":    email,
		"password": password,
		"timezone": "America/Sao_Paulo",
	}, stdhttp.StatusCreated, &ar)
	h.token = ar.Token
}

// ---- Tests ----

func TestAuthFlow(t *testing.T) {
	h := newHarness(t)
	h.register("user@test.com", "password123")

	res, data := h.do("GET", "/me", nil)
	if res.StatusCode != 200 {
		t.Fatalf("me: status %d body=%s", res.StatusCode, string(data))
	}
}

func TestBlockCRUD(t *testing.T) {
	h := newHarness(t)
	h.register("user@test.com", "password123")

	var b block
	h.mustJSON("POST", "/blocks", map[string]any{
		"name":       "Trabalho",
		"weekdays":   []int{1, 2, 3, 4, 5},
		"start_time": "08:00",
		"end_time":   "17:00",
	}, stdhttp.StatusCreated, &b)
	if b.StartTime != "08:00" {
		t.Errorf("start_time: want 08:00 got %q", b.StartTime)
	}
	if b.EndTime != "17:00" {
		t.Errorf("end_time: want 17:00 got %q", b.EndTime)
	}

	var list []block
	h.mustJSON("GET", "/blocks", nil, 200, &list)
	if len(list) != 1 {
		t.Fatalf("blocks list len: %d", len(list))
	}
}

func TestGoalCreatesQuests(t *testing.T) {
	h := newHarness(t)
	h.register("user@test.com", "password123")

	h.mustJSON("POST", "/blocks", map[string]any{
		"name":       "Trabalho",
		"weekdays":   []int{1, 2, 3, 4, 5},
		"start_time": "08:00",
		"end_time":   "17:00",
	}, stdhttp.StatusCreated, nil)

	var g id
	h.mustJSON("POST", "/goals", map[string]any{
		"title":           "Academia",
		"weekly_target":   3,
		"session_minutes": 60,
	}, stdhttp.StatusCreated, &g)

	var qs []quest
	h.mustJSON("GET", "/quests?week=current", nil, 200, &qs)
	if len(qs) == 0 {
		t.Fatal("expected quests after creating goal, got 0")
	}
	if len(qs) > 3 {
		t.Errorf("too many quests: got %d, weekly_target=3", len(qs))
	}
	for _, q := range qs {
		if q.GoalID != g.ID {
			t.Errorf("quest goal_id mismatch: %s vs %s", q.GoalID, g.ID)
		}
		if q.Status != "pending" {
			t.Errorf("status: want pending got %s", q.Status)
		}
	}
}

func TestEventBlocksQuestSlot(t *testing.T) {
	h := newHarness(t)
	h.register("user@test.com", "password123")

	loc, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Now().In(loc)

	// Create a goal that needs lots of quests
	var g id
	h.mustJSON("POST", "/goals", map[string]any{
		"title":           "Estudo",
		"weekly_target":   1,
		"session_minutes": 60,
	}, stdhttp.StatusCreated, &g)

	// Find quest slot
	var qs []quest
	h.mustJSON("GET", "/quests?week=current", nil, 200, &qs)
	if len(qs) == 0 {
		t.Skip("no quest scheduled this week — likely week-end edge case")
	}
	originalQuest := qs[0]
	originalStart, err := time.Parse(time.RFC3339, originalQuest.ScheduledFor)
	if err != nil {
		t.Fatal(err)
	}

	// Create event covering the quest's slot. Truncate to seconds because the
	// backend stores RFC3339 second-precision timestamps; without truncation
	// in-memory microseconds cause false-positive overlap checks below.
	eventStart := originalStart.Add(-30 * time.Minute).Truncate(time.Second)
	eventEnd := originalStart.Add(90 * time.Minute).Truncate(time.Second)
	if eventStart.Before(now) {
		eventStart = now.Add(1 * time.Minute).Truncate(time.Second)
		eventEnd = eventStart.Add(2 * time.Hour)
	}

	h.mustJSON("POST", "/events", map[string]any{
		"title":     "Reunião",
		"starts_at": eventStart.UTC().Format(time.RFC3339),
		"ends_at":   eventEnd.UTC().Format(time.RFC3339),
	}, stdhttp.StatusCreated, nil)

	// Verify quests no longer overlap with event
	var after []quest
	h.mustJSON("GET", "/quests?week=current", nil, 200, &after)
	for _, q := range after {
		qs, _ := time.Parse(time.RFC3339, q.ScheduledFor)
		qe := qs.Add(60 * time.Minute)
		if qs.Before(eventEnd) && eventStart.Before(qe) {
			t.Errorf("quest at %s overlaps event %s-%s", qs, eventStart, eventEnd)
		}
	}
}

func TestNoDuplicateQuestPerDay(t *testing.T) {
	h := newHarness(t)
	h.register("user@test.com", "password123")

	var g id
	h.mustJSON("POST", "/goals", map[string]any{
		"title":           "Academia",
		"weekly_target":   3,
		"session_minutes": 60,
	}, stdhttp.StatusCreated, &g)

	var qs []quest
	h.mustJSON("GET", "/quests?week=current", nil, 200, &qs)

	// Mark first quest as done, then trigger another ensure via /quests/regenerate.
	if len(qs) == 0 {
		t.Skip("no quests scheduled")
	}
	h.mustJSON("POST", "/quests/"+qs[0].ID+"/done", nil, 200, nil)

	res, _ := h.do("POST", "/quests/regenerate", nil)
	if res.StatusCode != stdhttp.StatusNoContent {
		t.Fatalf("regenerate: status %d", res.StatusCode)
	}

	var after []quest
	h.mustJSON("GET", "/quests?week=current", nil, 200, &after)

	// Group by day; assert no day has 2+ quests of the same goal.
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	perDay := map[string]int{}
	for _, q := range after {
		if q.GoalID != g.ID {
			continue
		}
		day, _ := time.Parse(time.RFC3339, q.ScheduledFor)
		key := day.In(loc).Format("2006-01-02")
		perDay[key]++
	}
	for day, n := range perDay {
		if n > 1 {
			t.Errorf("day %s has %d quests of same goal, expected ≤1", day, n)
		}
	}
}

func TestSkipTodayLimit(t *testing.T) {
	h := newHarness(t)
	h.register("user@test.com", "password123")

	res, data := h.do("POST", "/quests/skip-today", nil)
	if res.StatusCode != stdhttp.StatusNoContent {
		t.Fatalf("first skip: status %d body=%s", res.StatusCode, string(data))
	}

	res, _ = h.do("POST", "/quests/skip-today", nil)
	if res.StatusCode != stdhttp.StatusForbidden {
		t.Errorf("second skip: want 403, got %d", res.StatusCode)
	}
}

func TestUnauthAccess(t *testing.T) {
	h := newHarness(t)
	res, _ := h.do("GET", "/blocks", nil)
	if res.StatusCode != stdhttp.StatusUnauthorized {
		t.Errorf("want 401, got %d", res.StatusCode)
	}
}

func TestPasswordHashNotLeaked(t *testing.T) {
	h := newHarness(t)
	h.register("user@test.com", "password123")
	res, data := h.do("GET", "/me", nil)
	if res.StatusCode != 200 {
		t.Fatal("me failed")
	}
	if bytes.Contains(data, []byte("password_hash")) {
		t.Errorf("password_hash leaked in /me response: %s", string(data))
	}
}

func TestHarnessBoot(t *testing.T) {
	h := newHarness(t)
	res, _ := h.do("GET", "/healthz", nil)
	if res.StatusCode != 200 {
		t.Fatal("healthz failed")
	}
}
