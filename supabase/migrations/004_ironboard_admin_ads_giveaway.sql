-- IronBoard 004: admin console, board ads, and the monthly giveaway
-- Run once in Supabase Dashboard > SQL Editor (paste the whole file, click Run).
-- Safe to re-run: every statement guards with IF NOT EXISTS / DROP POLICY IF EXISTS.
--
-- What this adds:
--   * gyms.giveaway_enabled + gyms.giveaway_prize — the per-gym giveaway
--     switch and prize, toggleable from the admin console or the gym
--     owner's console. Off by default.
--   * ads — one row per board advertisement (title, description, image
--     only, per Ian's Nov 11 decision). The public display reads these
--     instead of the two hard-coded placeholder ads. No price or revenue
--     split columns — money tracking is a later build.
--   * giveaway_entries — one row per member per day they logged a lift
--     while the giveaway was on. The unique constraint is what enforces
--     "1 entry per day": a second log the same day is ignored.
--   * giveaway_winners — one row per monthly draw, so the board can show
--     the current month's winner and the consoles can list past winners.
--
-- Admin is Ian's Gmail account (ianoliver2k@gmail.com), checked against
-- the email in the signed-in user's JWT. Only that account can manage ads
-- or edit any gym. Gym owners can toggle their own gym's giveaway, set
-- its prize, and run their own draw. Members can only add their own
-- entries, one per day.

-- 1. Giveaway settings on the gym itself.
alter table public.gyms add column if not exists giveaway_enabled boolean not null default false;
alter table public.gyms add column if not exists giveaway_prize text;

-- 2. Board ads.
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  created_at timestamptz not null default now()
);
alter table public.ads enable row level security;

-- Anyone can read ads (the public gym screen rotates through them).
drop policy if exists "ads_read_all" on public.ads;
create policy "ads_read_all" on public.ads for select using (true);

-- Only the admin can add, change, or remove ads.
drop policy if exists "ads_manage_admin" on public.ads;
create policy "ads_manage_admin" on public.ads for insert
  with check ((auth.jwt() ->> 'email') = 'ianoliver2k@gmail.com');
drop policy if exists "ads_update_admin" on public.ads;
create policy "ads_update_admin" on public.ads for update
  using ((auth.jwt() ->> 'email') = 'ianoliver2k@gmail.com');
drop policy if exists "ads_delete_admin" on public.ads;
create policy "ads_delete_admin" on public.ads for delete
  using ((auth.jwt() ->> 'email') = 'ianoliver2k@gmail.com');

-- 3. Giveaway entries: one per member, per gym, per day.
create table if not exists public.giveaway_entries (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null,
  entry_date date not null,
  created_at timestamptz not null default now(),
  constraint giveaway_entries_one_per_day unique (gym_id, user_id, entry_date)
);
alter table public.giveaway_entries enable row level security;

-- A member can add their own entry (one per day — the unique constraint
-- rejects a second entry for the same day).
drop policy if exists "giveaway_entries_insert_own" on public.giveaway_entries;
create policy "giveaway_entries_insert_own" on public.giveaway_entries for insert
  with check (auth.uid() = user_id);

-- Entries are visible to the member themselves, the gym's owner, and the admin.
-- (Advertisers never see this table — they only get aggregate member stats.)
drop policy if exists "giveaway_entries_read_scoped" on public.giveaway_entries;
create policy "giveaway_entries_read_scoped" on public.giveaway_entries for select using (
  auth.uid() = user_id
  or (auth.jwt() ->> 'email') = 'ianoliver2k@gmail.com'
  or exists (
    select 1 from public.gyms g
    where g.id = giveaway_entries.gym_id
      and g.owner_id = auth.uid()
  )
);

-- 4. Giveaway winners: one row per draw.
create table if not exists public.giveaway_winners (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null,
  prize text,
  month text not null,
  drawn_at timestamptz not null default now(),
  drawn_by uuid
);
alter table public.giveaway_winners enable row level security;

-- Anyone can read winners (the public gym screen shows the current winner).
drop policy if exists "giveaway_winners_read_all" on public.giveaway_winners;
create policy "giveaway_winners_read_all" on public.giveaway_winners for select using (true);

-- Only the admin or the gym's owner can record a draw.
drop policy if exists "giveaway_winners_insert_admin_or_owner" on public.giveaway_winners;
create policy "giveaway_winners_insert_admin_or_owner" on public.giveaway_winners for insert
  with check (
    (auth.jwt() ->> 'email') = 'ianoliver2k@gmail.com'
    or exists (
      select 1 from public.gyms g
      where g.id = giveaway_winners.gym_id
        and g.owner_id = auth.uid()
    )
  );

-- 5. Let the admin edit any gym (name, logo, colour, giveaway switch,
-- prize). Owners can still only edit their own gym (existing policy).
drop policy if exists "gyms_update_admin" on public.gyms;
create policy "gyms_update_admin" on public.gyms for update
  using ((auth.jwt() ->> 'email') = 'ianoliver2k@gmail.com');
