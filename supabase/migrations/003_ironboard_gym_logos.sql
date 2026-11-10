-- IronBoard 003: gym logo storage
-- Run once in Supabase Dashboard > SQL Editor (paste the whole file, click Run).
-- Safe to re-run: the bucket insert guards with ON CONFLICT, and every
-- policy is dropped first.
--
-- Creates a public bucket called gym-logos for owner-uploaded gym logos.
-- Anyone can view a logo (the member app and the public gym screen both
-- show it); only signed-in users can upload, update, or delete files in it.
-- If this is not run, logo file uploads fail in the owner app with a
-- message saying so — pasting an image URL still works without it.

insert into storage.buckets (id, name, public)
values ('gym-logos', 'gym-logos', true)
on conflict (id) do nothing;

drop policy if exists "gym_logos_read_public" on storage.objects;
create policy "gym_logos_read_public" on storage.objects
  for select using (bucket_id = 'gym-logos');

drop policy if exists "gym_logos_upload_auth" on storage.objects;
create policy "gym_logos_upload_auth" on storage.objects
  for insert with check (bucket_id = 'gym-logos' and auth.role() = 'authenticated');

drop policy if exists "gym_logos_update_auth" on storage.objects;
create policy "gym_logos_update_auth" on storage.objects
  for update using (bucket_id = 'gym-logos' and auth.role() = 'authenticated');

drop policy if exists "gym_logos_delete_auth" on storage.objects;
create policy "gym_logos_delete_auth" on storage.objects
  for delete using (bucket_id = 'gym-logos' and auth.role() = 'authenticated');
