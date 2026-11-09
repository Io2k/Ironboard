-- IronBoard split: member app + public gym display
-- Run once in Supabase Dashboard > SQL Editor (paste the whole file, click Run).
-- Safe to re-run: every statement guards with IF NOT EXISTS / DROP POLICY IF EXISTS.

-- 1. Gyms: join code + owner
alter table public.gyms add column if not exists code text;
alter table public.gyms add column if not exists owner_id uuid;
create unique index if not exists gyms_code_unique on public.gyms (code);

-- 2. Profiles: display name + gender (used for the male/female best-lift boards)
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists gender text
  check (gender in ('male', 'female', 'prefer_not_to_say'));

-- 3. Workouts: share-with-gym flag
alter table public.workouts add column if not exists share_with_gym boolean not null default true;

-- 4. Row Level Security
alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.workouts enable row level security;

-- Gyms: anyone can read (display page + join-by-code need it).
-- Signed-in users can create a gym; only the owner can update it.
drop policy if exists "gyms_read_all" on public.gyms;
create policy "gyms_read_all" on public.gyms for select using (true);
drop policy if exists "gyms_insert_auth" on public.gyms;
create policy "gyms_insert_auth" on public.gyms for insert with check (auth.uid() = owner_id);
drop policy if exists "gyms_update_owner" on public.gyms;
create policy "gyms_update_owner" on public.gyms for update using (auth.uid() = owner_id);

-- Profiles: anyone can read (the display needs member names).
-- A user can only insert / update their own row (id = their auth user id).
drop policy if exists "profiles_read_all" on public.profiles;
create policy "profiles_read_all" on public.profiles for select using (true);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Workouts: anyone can read (display page + gym feed).
-- Signed-in users can only log lifts as themselves.
drop policy if exists "workouts_read_all" on public.workouts;
create policy "workouts_read_all" on public.workouts for select using (true);
drop policy if exists "workouts_insert_own" on public.workouts;
create policy "workouts_insert_own" on public.workouts for insert with check (auth.uid() = user_id);
