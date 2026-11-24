-- IronBoard music: start/stop from the owner console (migration 006)
-- Run in Supabase Dashboard > SQL Editor for the IronBoard-db project.
--
-- What this adds:
--   * gyms.music_playing (boolean, default false): the owner console's
--     Start/Stop music switch. The board reads it (it already re-reads the
--     gym row every 30 seconds) and starts or stops the radio stream to
--     match — the board itself no longer has a start button.
--
-- Browsers only allow sound after someone has tapped on the page at least
-- once, so the first time the owner starts music the board may show a
-- "tap anywhere to enable sound" hint. One tap on the board unlocks it,
-- and the console switch works from then on.

alter table public.gyms
  add column if not exists music_playing boolean not null default false;
