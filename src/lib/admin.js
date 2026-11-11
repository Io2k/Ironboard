// Admin access for IronBoard: Ian's Gmail account only.
// The same address is checked in the database (migration 004 RLS policies),
// so the app and the database agree on who the admin is.
export const ADMIN_EMAIL = 'ianoliver2k@gmail.com';

export function isAdmin(user) {
  return !!user?.email && user.email.toLowerCase() === ADMIN_EMAIL;
}

// "2026-11" for a date — the giveaway month key. Uses the local date so a
// lift logged late at night counts for the day the member logged it.
export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function todayKey(d = new Date()) {
  return d.toISOString().split('T')[0];
}

// Days since the start of the current month, for "new this month" cut-offs.
export function startOfMonthISO(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

export function thirtyDaysAgoISO(d = new Date()) {
  return new Date(d.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
}
