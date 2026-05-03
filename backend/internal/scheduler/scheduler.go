package scheduler

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/robfig/cron/v3"

	"github.com/hugoadriano/quest-engine/internal/store"
)

type Scheduler struct {
	q *store.Queries
}

func New(q *store.Queries) *Scheduler {
	return &Scheduler{q: q}
}

// Start registers cron jobs and runs them in the same process.
func (s *Scheduler) Start(ctx context.Context) (*cron.Cron, error) {
	c := cron.New()
	if _, err := c.AddFunc("0 22 * * 0", func() { s.RunWeeklyAll(ctx) }); err != nil {
		return nil, err
	}
	c.Start()
	return c, nil
}

// PlanWeek computes quest slots for a single user for the upcoming week.
// Pure function — easy to unit test. Caller persists the returned plan.
func PlanWeek(now time.Time, loc *time.Location, blocks []store.Block, goals []store.Goal) []PlannedQuest {
	weekStart := startOfNextMonday(now.In(loc))
	free := freeSlots(weekStart, blocks, loc)

	var plan []PlannedQuest
	for _, g := range goals {
		dur := time.Duration(g.SessionMinutes) * time.Minute
		assigned := assign(free, dur, int(g.WeeklyTarget))
		for _, slot := range assigned {
			plan = append(plan, PlannedQuest{GoalID: g.ID, Start: slot})
		}
	}
	return plan
}

type PlannedQuest struct {
	GoalID uuid.UUID
	Start  time.Time
}

// freeSlots returns 7 daily windows (one per day of the week) where each window
// is the largest contiguous gap between blocks on that weekday.
// Simpler: return the full day minus blocks, as discrete intervals.
func freeSlots(weekStart time.Time, blocks []store.Block, loc *time.Location) []interval {
	var out []interval
	for d := 0; d < 7; d++ {
		day := weekStart.AddDate(0, 0, d)
		weekday := int16(day.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		dayStart := time.Date(day.Year(), day.Month(), day.Day(), 6, 0, 0, 0, loc)
		dayEnd := time.Date(day.Year(), day.Month(), day.Day(), 23, 0, 0, 0, loc)

		var dayBlocks []interval
		for _, b := range blocks {
			if !contains(b.Weekdays, weekday) {
				continue
			}
			bs := timeOnDay(day, b.StartTime, loc)
			be := timeOnDay(day, b.EndTime, loc)
			dayBlocks = append(dayBlocks, interval{bs, be})
		}
		sort.Slice(dayBlocks, func(i, j int) bool { return dayBlocks[i].start.Before(dayBlocks[j].start) })

		cursor := dayStart
		for _, b := range dayBlocks {
			if b.start.After(cursor) {
				out = append(out, interval{cursor, minTime(b.start, dayEnd)})
			}
			if b.end.After(cursor) {
				cursor = b.end
			}
		}
		if cursor.Before(dayEnd) {
			out = append(out, interval{cursor, dayEnd})
		}
	}
	return out
}

type interval struct {
	start, end time.Time
}

// assign picks N start times across given free intervals, distributing across days.
func assign(slots []interval, dur time.Duration, n int) []time.Time {
	// Group slots by date.
	byDay := map[string][]interval{}
	var dayKeys []string
	for _, s := range slots {
		k := s.start.Format("2006-01-02")
		if _, ok := byDay[k]; !ok {
			dayKeys = append(dayKeys, k)
		}
		byDay[k] = append(byDay[k], s)
	}
	sort.Strings(dayKeys)

	var picked []time.Time
	dayIdx := 0
	for len(picked) < n && len(dayKeys) > 0 {
		key := dayKeys[dayIdx%len(dayKeys)]
		day := byDay[key]
		var taken bool
		for i, iv := range day {
			if iv.end.Sub(iv.start) >= dur {
				picked = append(picked, iv.start)
				day[i] = interval{iv.start.Add(dur), iv.end}
				byDay[key] = day
				taken = true
				break
			}
		}
		dayIdx++
		if !taken && dayIdx >= len(dayKeys)*3 {
			break // no more capacity
		}
	}
	return picked
}

func startOfNextMonday(t time.Time) time.Time {
	wd := int(t.Weekday())
	if wd == 0 {
		wd = 7
	}
	daysUntilMonday := (8 - wd) % 7
	if daysUntilMonday == 0 {
		daysUntilMonday = 7
	}
	d := t.AddDate(0, 0, daysUntilMonday)
	return time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, t.Location())
}

func contains(arr []int16, v int16) bool {
	for _, x := range arr {
		if x == v {
			return true
		}
	}
	return false
}

func timeOnDay(day time.Time, t pgtype.Time, loc *time.Location) time.Time {
	micros := t.Microseconds
	hh := micros / 3_600_000_000
	rem := micros % 3_600_000_000
	mm := rem / 60_000_000
	return time.Date(day.Year(), day.Month(), day.Day(), int(hh), int(mm), 0, 0, loc)
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}

func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}
