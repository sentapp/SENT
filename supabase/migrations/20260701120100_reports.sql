-- User-submitted reports for admin triage (distinct from feedback).

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  type text not null default 'general',
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists reports_created_at_idx on public.reports (created_at desc);
create index if not exists reports_status_idx on public.reports (status);

alter table public.reports enable row level security;

create policy "Users can submit reports"
  on public.reports
  for insert
  to anon, authenticated
  with check (user_id is null or auth.uid() = user_id);

create policy "Admins can read reports"
  on public.reports
  for select
  to authenticated
  using (public.auth_user_is_admin());

create policy "Admins can update reports"
  on public.reports
  for update
  to authenticated
  using (public.auth_user_is_admin())
  with check (public.auth_user_is_admin());
