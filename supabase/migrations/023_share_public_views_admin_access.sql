-- Treat every authenticated user as an admin who can edit or delete any
-- public_views row, not only the original creator. Matches the dude.fi
-- workspace model where signed-in users are a small trusted team.

drop policy if exists "Users can update own public_views" on public.public_views;
create policy "Authenticated users can update public_views"
  on public.public_views
  for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

drop policy if exists "Users can delete own public_views" on public.public_views;
create policy "Authenticated users can delete public_views"
  on public.public_views
  for delete
  using (auth.uid() is not null);
