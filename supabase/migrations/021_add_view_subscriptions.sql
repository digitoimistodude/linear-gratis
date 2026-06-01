-- Customer email subscriptions: when a customer leaves a comment or files an
-- issue via a public view and opts in by entering an email, we store one row
-- here. Webhook handlers email these subscribers when Linear-side replies or
-- updates land on their issue. Unsubscribe is via a token in the email footer.

create table if not exists public.view_subscriptions (
  id uuid primary key default gen_random_uuid(),
  view_id uuid not null references public.public_views(id) on delete cascade,
  issue_id text not null,
  email text not null,
  unsubscribe_token text not null unique,
  created_at timestamptz not null default now(),
  unique (view_id, issue_id, email)
);

create index if not exists view_subscriptions_view_issue_idx
  on public.view_subscriptions (view_id, issue_id);

create index if not exists view_subscriptions_issue_idx
  on public.view_subscriptions (issue_id);

alter table public.view_subscriptions enable row level security;

-- Service role inserts/reads from the worker. No anon access; subscriptions
-- are treated as PII so they never leave the server.
create policy "service role manages view_subscriptions"
  on public.view_subscriptions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
