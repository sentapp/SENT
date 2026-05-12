-- Idempotent safeguard: some environments reported missing public.mission_pushes
-- even when earlier migrations were skipped. Matches 20260616100000_mission_pushes_and_connected_missionary_rpc.sql.

create table if not exists public.mission_pushes (
  id uuid primary key default gen_random_uuid(),
  missionary_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  goal_amount numeric(14, 2) not null,
  raised_amount numeric(14, 2) not null default 0,
  deadline date,
  giving_link text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mission_pushes_missionary_active_idx
  on public.mission_pushes (missionary_id, is_active, created_at desc);

drop trigger if exists mission_pushes_set_updated_at on public.mission_pushes;
create trigger mission_pushes_set_updated_at
  before update on public.mission_pushes
  for each row execute procedure public.set_updated_at();

alter table public.mission_pushes enable row level security;

drop policy if exists "Missionaries manage own pushes" on public.mission_pushes;
create policy "Missionaries manage own pushes"
  on public.mission_pushes for all
  to authenticated
  using (missionary_id = auth.uid())
  with check (missionary_id = auth.uid());

drop policy if exists "Supporters can view connected missionary pushes" on public.mission_pushes;
create policy "Supporters can view connected missionary pushes"
  on public.mission_pushes for select
  to authenticated
  using (
    missionary_id in (
      select pr.connected_missionary_id
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.connected_missionary_id is not null
    )
  );
