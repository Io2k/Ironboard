-- IronBoard 002: let users delete lift entries
-- Run once in Supabase Dashboard > SQL Editor (paste the whole file, click Run).
-- Safe to re-run: DROP POLICY IF EXISTS guards the create.
--
-- Without this, the Delete button in the member app does nothing: Supabase
-- blocks the delete because no delete policy exists for workouts yet.
-- With it:
--   * any member can delete their own lifts, and
--   * a gym owner can delete any lift in their gym (to clear a wrong
--     entry off the TV screen).
-- Nobody else can delete anyone else's lifts.

drop policy if exists "workouts_delete_own_or_gym_owner" on public.workouts;
create policy "workouts_delete_own_or_gym_owner" on public.workouts for delete using (
  auth.uid() = user_id
  or exists (
    select 1 from public.gyms g
    where g.id = workouts.gym_id
      and g.owner_id = auth.uid()
  )
);
