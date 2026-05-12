-- Idempotent safeguard: `communication_logs` is defined in 20260520100000_core_schema.sql.
-- This migration repairs missing tables or policies on older / partial deployments.

create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  missionary_id uuid not null references public.profiles (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  comm_type public.communication_type not null,
  notes text default '',
  created_at timestamptz not null default now()
);

create index if not exists communication_logs_missionary_created_idx
  on public.communication_logs (missionary_id, created_at desc);

create index if not exists communication_logs_contact_created_idx
  on public.communication_logs (contact_id, created_at desc);

alter table public.communication_logs enable row level security;

drop policy if exists "Missionary manages communication logs" on public.communication_logs;
create policy "Missionary manages communication logs"
  on public.communication_logs for all
  to authenticated
  using (missionary_id = auth.uid())
  with check (missionary_id = auth.uid());
