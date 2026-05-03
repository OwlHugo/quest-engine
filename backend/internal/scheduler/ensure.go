package scheduler

import (
	"context"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/hugoadriano/quest-engine/internal/store"
)

// EnsureCurrentWeek tops up the current week's quests so that each active goal
// has at least weekly_target quests scheduled. Idempotent — counts existing
// quests in the current week (any status) and only creates the missing ones.
//
// Called after a user creates/edits a goal or block, and on first login.
func (s *Scheduler) EnsureCurrentWeek(ctx context.Context, userID uuid.UUID) error {
	user, err := s.q.GetUserByID(ctx, userID)
	if err != nil {
		return err
	}
	loc, err := time.LoadLocation(user.Timezone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	weekStart, weekEnd := currentWeekRange(now, loc)

	blocks, err := s.q.ListBlocks(ctx, userID)
	if err != nil {
		return err
	}
	goals, err := s.q.ListGoalsForUser(ctx, userID)
	if err != nil {
		return err
	}

	existing, err := s.q.ListQuestsBetween(ctx, store.ListQuestsBetweenParams{
		UserID:         userID,
		ScheduledFor:   pgtype.Timestamptz{Time: weekStart, Valid: true},
		ScheduledFor_2: pgtype.Timestamptz{Time: weekEnd, Valid: true},
	})
	if err != nil {
		return err
	}
	events, err := s.q.ListEventsBetween(ctx, store.ListEventsBetweenParams{
		UserID:     userID,
		RangeStart: pgtype.Timestamptz{Time: weekStart, Valid: true},
		RangeEnd:   pgtype.Timestamptz{Time: weekEnd, Valid: true},
	})
	if err != nil {
		return err
	}

	goalByID := map[uuid.UUID]store.Goal{}
	for _, g := range goals {
		goalByID[g.ID] = g
	}

	// Delete pending quests that conflict with events. Topup recreates them.
	for _, q := range existing {
		if q.Status != "pending" {
			continue
		}
		g, ok := goalByID[q.GoalID]
		if !ok {
			continue
		}
		qStart := q.ScheduledFor.Time
		qEnd := qStart.Add(time.Duration(g.SessionMinutes) * time.Minute)
		if overlapsAny(qStart, qEnd, events, loc) {
			if err := s.q.DeletePendingQuestByID(ctx, q.ID); err != nil {
				return err
			}
		}
	}

	// Recount surviving quests.
	survivors, err := s.q.ListQuestsBetween(ctx, store.ListQuestsBetweenParams{
		UserID:         userID,
		ScheduledFor:   pgtype.Timestamptz{Time: weekStart, Valid: true},
		ScheduledFor_2: pgtype.Timestamptz{Time: weekEnd, Valid: true},
	})
	if err != nil {
		return err
	}
	existingByGoal := map[uuid.UUID]int{}
	existingByGoalDay := map[uuid.UUID]map[string]int{}
	for _, q := range survivors {
		existingByGoal[q.GoalID]++
		day := q.ScheduledFor.Time.In(loc).Format("2006-01-02")
		if existingByGoalDay[q.GoalID] == nil {
			existingByGoalDay[q.GoalID] = map[string]int{}
		}
		existingByGoalDay[q.GoalID][day]++
	}

	free := freeSlotsInRange(weekStart, weekEnd, blocks, events, loc, now)
	free = subtractPendingQuests(free, survivors, goalByID)
	plan := planTopUp(free, goals, existingByGoal, existingByGoalDay)

	for _, p := range plan {
		if _, err := s.q.CreateQuest(ctx, store.CreateQuestParams{
			GoalID:       p.GoalID,
			UserID:       userID,
			ScheduledFor: pgtype.Timestamptz{Time: p.Start, Valid: true},
		}); err != nil {
			return err
		}
	}
	return nil
}

// currentWeekRange returns Monday 00:00 (this week, inclusive) to next Monday 00:00.
func currentWeekRange(now time.Time, loc *time.Location) (time.Time, time.Time) {
	wd := int(now.Weekday())
	if wd == 0 {
		wd = 7
	}
	monday := time.Date(now.Year(), now.Month(), now.Day()-wd+1, 0, 0, 0, 0, loc)
	return monday, monday.AddDate(0, 0, 7)
}

// freeSlotsInRange returns the per-day free intervals between weekStart and
// weekEnd, excluding intervals fully in the past relative to `now`. Subtracts
// recurring blocks AND one-off events from each day.
func freeSlotsInRange(weekStart, weekEnd time.Time, blocks []store.Block, events []store.Event, loc *time.Location, now time.Time) []interval {
	var out []interval
	for d := weekStart; d.Before(weekEnd); d = d.AddDate(0, 0, 1) {
		weekday := int16(d.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		dayStart := time.Date(d.Year(), d.Month(), d.Day(), 6, 0, 0, 0, loc)
		dayEnd := time.Date(d.Year(), d.Month(), d.Day(), 23, 0, 0, 0, loc)

		var busy []interval
		for _, b := range blocks {
			if !contains(b.Weekdays, weekday) {
				continue
			}
			bs := timeOnDay(d, b.StartTime, loc)
			be := timeOnDay(d, b.EndTime, loc)
			busy = append(busy, interval{bs, be})
		}
		for _, e := range events {
			es := e.StartsAt.Time.In(loc)
			ee := e.EndsAt.Time.In(loc)
			if ee.Before(dayStart) || es.After(dayEnd) {
				continue
			}
			busy = append(busy, interval{maxTime(es, dayStart), minTime(ee, dayEnd)})
		}
		sort.Slice(busy, func(i, j int) bool { return busy[i].start.Before(busy[j].start) })

		cursor := dayStart
		for _, b := range busy {
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
	// Trim slots fully in the past; clip slots straddling now.
	// Apply a 30-min lead time and round to next 15-min boundary so quests
	// don't land at awkward "scheduled for right now" timestamps.
	minStart := roundUp15(now.Add(30 * time.Minute))
	trimmed := out[:0]
	for _, iv := range out {
		if !iv.end.After(minStart) {
			continue
		}
		if iv.start.Before(minStart) {
			iv.start = minStart
		}
		trimmed = append(trimmed, iv)
	}
	return trimmed
}

// roundUp15 rounds t up to the next 15-minute boundary.
func roundUp15(t time.Time) time.Time {
	mins := t.Minute()
	rem := mins % 15
	if rem == 0 && t.Second() == 0 && t.Nanosecond() == 0 {
		return t
	}
	delta := 15 - rem
	rounded := t.Add(time.Duration(delta) * time.Minute)
	return time.Date(rounded.Year(), rounded.Month(), rounded.Day(), rounded.Hour(), rounded.Minute(), 0, 0, rounded.Location())
}

// overlapsAny returns true if [start, end) overlaps any event.
func overlapsAny(start, end time.Time, events []store.Event, loc *time.Location) bool {
	for _, e := range events {
		es := e.StartsAt.Time.In(loc)
		ee := e.EndsAt.Time.In(loc)
		if start.Before(ee) && es.Before(end) {
			return true
		}
	}
	return false
}

// subtractPendingQuests removes from free slots the windows already occupied
// by surviving pending quests, so topup doesn't double-book.
func subtractPendingQuests(free []interval, quests []store.Quest, goals map[uuid.UUID]store.Goal) []interval {
	out := make([]interval, 0, len(free))
	for _, f := range free {
		fragments := []interval{f}
		for _, q := range quests {
			if q.Status != "pending" {
				continue
			}
			g, ok := goals[q.GoalID]
			if !ok {
				continue
			}
			qs := q.ScheduledFor.Time
			qe := qs.Add(time.Duration(g.SessionMinutes) * time.Minute)
			next := fragments[:0]
			for _, frag := range fragments {
				if !qs.Before(frag.end) || !frag.start.Before(qe) {
					next = append(next, frag)
					continue
				}
				if frag.start.Before(qs) {
					next = append(next, interval{frag.start, qs})
				}
				if qe.Before(frag.end) {
					next = append(next, interval{qe, frag.end})
				}
			}
			fragments = next
		}
		out = append(out, fragments...)
	}
	return out
}

// planTopUp produces the missing quests so each goal reaches weekly_target.
// Caps at one quest per day per goal — habits are more sustainable spread out.
// If the week has fewer remaining days than the target, generate what fits.
func planTopUp(
	free []interval,
	goals []store.Goal,
	existing map[uuid.UUID]int,
	existingByDay map[uuid.UUID]map[string]int,
) []PlannedQuest {
	var plan []PlannedQuest
	for _, g := range goals {
		need := int(g.WeeklyTarget) - existing[g.ID]
		if need <= 0 {
			continue
		}
		dur := time.Duration(g.SessionMinutes) * time.Minute
		picked := assignOnePerDay(free, dur, need, existingByDay[g.ID])
		for _, start := range picked {
			plan = append(plan, PlannedQuest{GoalID: g.ID, Start: start})
		}
	}
	return plan
}

// assignOnePerDay picks up to N start times, at most one per day, in earliest
// available slot of each day. Skips days where the goal already has a quest.
// Mutates the free slots in place to reserve the chosen window.
func assignOnePerDay(slots []interval, dur time.Duration, n int, busyDays map[string]int) []time.Time {
	byDay := map[string][]int{}
	var dayKeys []string
	for i, s := range slots {
		k := s.start.Format("2006-01-02")
		if _, ok := byDay[k]; !ok {
			dayKeys = append(dayKeys, k)
		}
		byDay[k] = append(byDay[k], i)
	}
	sort.Strings(dayKeys)

	var picked []time.Time
	for _, k := range dayKeys {
		if len(picked) >= n {
			break
		}
		if busyDays[k] > 0 {
			continue
		}
		for _, idx := range byDay[k] {
			iv := slots[idx]
			if iv.end.Sub(iv.start) >= dur {
				picked = append(picked, iv.start)
				slots[idx] = interval{iv.start.Add(dur), iv.end}
				break
			}
		}
	}
	return picked
}
