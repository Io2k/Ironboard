-- IronBoard music on the gym board (migration 005)
-- Run in Supabase Dashboard > SQL Editor for the IronBoard-db project.
--
-- What this adds:
--   * gyms.music_source ('off' | 'radio' | 'spotify') plus the station
--     name/URL for radio, or the Spotify playlist for Spotify.
--   * spotify_tokens: one row per gym holding the owner's Spotify refresh
--     token. Readable only by that gym's owner and the IronBoard admin
--     (ianoliver2k@gmail.com). The browser never stores the refresh token
--     in localStorage; the owner's console reads it only to mint a
--     short-lived access token.
--   * music_now_playing: a public snapshot the board ticker reads
--     (track/artist/playlist, no tokens, no account data). Anyone can read
--     it; only the gym's owner and the admin can write it.

alter table public.gyms
  add column if not exists music_source text not null default 'off'
    check (music_source in ('off', 'radio', 'spotify')),
  add column if not exists music_station_name text,
  add column if not exists music_station_url text,
  add column if not exists music_spotify_playlist_id text,
  add column if not exists music_spotify_playlist_name text;

create table if not exists public.spotify_tokens (
  gym_id uuid primary key references public.gyms (id) on delete cascade,
  refresh_token text not null,
  scope text,
  updated_at timestamptz not null default now()
);

alter table public.spotify_tokens enable row level security;

drop policy if exists "spotify_tokens_owner_admin" on public.spotify_tokens;
create policy "spotify_tokens_owner_admin" on public.spotify_tokens
  for all
  using (
    exists (
      select 1 from public.gyms g
      where g.id = spotify_tokens.gym_id
        and (g.owner_id = auth.uid() or (auth.jwt() ->> 'email') = 'ianoliver2k@gmail.com')
    )
  )
  with check (
    exists (
      select 1 from public.gyms g
      where g.id = spotify_tokens.gym_id
        and (g.owner_id = auth.uid() or (auth.jwt() ->> 'email') = 'ianoliver2k@gmail.com')
    )
  );

create table if not exists public.music_now_playing (
  gym_id uuid primary key references public.gyms (id) on delete cascade,
  source text not null default 'spotify',
  track_name text,
  artist_name text,
  playlist_name text,
  is_playing boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.music_now_playing enable row level security;

drop policy if exists "music_now_playing_read_all" on public.music_now_playing;
create policy "music_now_playing_read_all" on public.music_now_playing
  for select using (true);

drop policy if exists "music_now_playing_write_owner_admin" on public.music_now_playing;
create policy "music_now_playing_write_owner_admin" on public.music_now_playing
  for all
  using (
    exists (
      select 1 from public.gyms g
      where g.id = music_now_playing.gym_id
        and (g.owner_id = auth.uid() or (auth.jwt() ->> 'email') = 'ianoliver2k@gmail.com')
    )
  )
  with check (
    exists (
      select 1 from public.gyms g
      where g.id = music_now_playing.gym_id
        and (g.owner_id = auth.uid() or (auth.jwt() ->> 'email') = 'ianoliver2k@gmail.com')
    )
  );
