// Shared gym stats for the admin console and the gym owner's console.
// Everything here is computed from rows the app already reads (profiles +
// workouts + giveaway entries) — no board-view tracking, per Ian's Nov 11
// decision. Advertisers only ever see these aggregate numbers, never
// member names or emails.

import { startOfMonthISO, thirtyDaysAgoISO, monthKey } from './admin';

// profiles: rows from `profiles` for this gym (id, display_name, created_at)
// workouts: rows from `workouts` for this gym (user_id, created_at, date)
// entries: rows from `giveaway_entries` for this gym this month (user_id, entry_date)
export function computeGymStats(profiles, workouts, entries = []) {
  const now = new Date();
  const monthStart = startOfMonthISO(now);
  const activeSince = thirtyDaysAgoISO(now);
  const thisMonth = monthKey(now);

  const liftsThisMonth = workouts.filter((w) => w.created_at >= monthStart);

  // A member is "active" if they logged at least one lift in the last 30 days.
  const activeIds = new Set(
    workouts.filter((w) => w.created_at >= activeSince).map((w) => w.user_id)
  );

  // Lifts per day for the last 14 days (oldest first, for a small bar chart).
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    daily.push({ date: key, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), count: 0 });
  }
  const byDay = {};
  daily.forEach((d) => { byDay[d.date] = d; });
  workouts.forEach((w) => {
    const key = (w.created_at || '').split('T')[0];
    if (byDay[key]) byDay[key].count += 1;
  });

  // Per-member roll-up: lifts, active days, and giveaway entries this month.
  const entriesByUser = {};
  entries.forEach((e) => {
    entriesByUser[e.user_id] = (entriesByUser[e.user_id] || 0) + 1;
  });
  const liftsByUser = {};
  const daysByUser = {};
  workouts.forEach((w) => {
    liftsByUser[w.user_id] = (liftsByUser[w.user_id] || 0) + 1;
    const days = daysByUser[w.user_id] || new Set();
    days.add((w.created_at || '').split('T')[0]);
    daysByUser[w.user_id] = days;
  });
  const members = (profiles || []).map((p) => ({
    id: p.id,
    name: p.display_name || p.username || 'Member',
    joinedAt: p.created_at || '',
    lifts: liftsByUser[p.id] || 0,
    activeDays: (daysByUser[p.id] || new Set()).size,
    entries: entriesByUser[p.id] || 0,
    active: activeIds.has(p.id),
  })).sort((a, b) => b.lifts - a.lifts);

  return {
    totalMembers: (profiles || []).length,
    newThisMonth: (profiles || []).filter((p) => p.created_at && p.created_at >= monthStart).length,
    totalLifts: workouts.length,
    liftsThisMonth: liftsThisMonth.length,
    activeMembers: activeIds.size,
    daily,
    members,
    entriesThisMonth: entries.length,
    entrantsThisMonth: Object.keys(entriesByUser).length,
    month: thisMonth,
  };
}
