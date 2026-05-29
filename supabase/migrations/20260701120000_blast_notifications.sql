-- Admin blast notification log (one row per blast send).

create table if not exists public.blast_notifications (
  id uuid primary key default gen_random_uuid(),
  sent_by uuid references public.profiles (id) on delete set null,
  title text not null,
  body text,
  recipient_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists blast_notifications_created_at_idx
  on public.blast_notifications (created_at desc);

alter table public.blast_notifications enable row level security;

create policy "Admins can read blast notifications"
  on public.blast_notifications
  for select
  to authenticated
  using (public.auth_user_is_admin());

create policy "Admins can insert blast notifications"
  on public.blast_notifications
  for insert
  to authenticated
  with check (public.auth_user_is_admin());
