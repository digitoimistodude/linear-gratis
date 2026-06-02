-- In-app notification feed for the admin bell icon. Mirrors the events that
-- already fire emails (new customer comment, new customer-filed issue,
-- threaded Linear reply on a customer thread) so the logged-in owner has a
-- live feed even if their inbox isn't open.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  view_id uuid references public.public_views(id) on delete cascade,
  issue_id text,
  issue_identifier text,
  kind text not null,
  title text not null,
  body text,
  url text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

-- Owners read their own; service role writes from the worker.
create policy "owner reads own notifications"
  on public.notifications
  for select
  using (auth.uid() = user_id);

create policy "owner marks own notifications read"
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "service role manages notifications"
  on public.notifications
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Required for the bell icon's Realtime subscription to receive INSERT events
-- as new notifications land. Idempotent: do nothing if the table is already
-- in the publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
