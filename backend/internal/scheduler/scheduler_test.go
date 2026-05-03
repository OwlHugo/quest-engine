package scheduler

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/hugoadriano/quest-engine/internal/store"
)

func mustTime(s string) pgtype.Time {
	var t pgtype.Time
	if err := t.Scan(s); err != nil {
		panic(err)
	}
	return t
}

func TestPlanWeek_DistributesAcrossDays(t *testing.T) {
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	now := time.Date(2026, 5, 3, 10, 0, 0, 0, loc) // Sunday

	work := store.Block{
		ID:        uuid.New(),
		Name:      "work",
		Weekdays:  []int16{1, 2, 3, 4, 5},
		StartTime: mustTime("08:00:00"),
		EndTime:   mustTime("17:00:00"),
	}
	college := store.Block{
		ID:        uuid.New(),
		Name:      "college",
		Weekdays:  []int16{1, 2, 3, 4, 5},
		StartTime: mustTime("19:00:00"),
		EndTime:   mustTime("22:00:00"),
	}
	gym := store.Goal{
		ID:             uuid.New(),
		Title:          "gym",
		WeeklyTarget:   3,
		SessionMinutes: 60,
	}

	plan := PlanWeek(now, loc, []store.Block{work, college}, []store.Goal{gym})

	if len(plan) != 3 {
		t.Fatalf("want 3 quests, got %d", len(plan))
	}
	days := map[string]int{}
	for _, p := range plan {
		days[p.Start.Format("2006-01-02")]++
	}
	if len(days) < 2 {
		t.Errorf("expected quests across multiple days, got %v", days)
	}
	for _, p := range plan {
		hour := p.Start.Hour()
		if hour >= 8 && hour < 17 {
			t.Errorf("quest scheduled inside work block: %v", p.Start)
		}
		if hour >= 19 && hour < 22 {
			t.Errorf("quest scheduled inside college block: %v", p.Start)
		}
	}
}
