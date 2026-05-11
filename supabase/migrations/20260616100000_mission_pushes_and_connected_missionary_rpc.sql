-- Mission fundraising pushes + RPC so supporters always resolve connected missionary (RLS-safe).

-- ---------------------------------------------------------------------------
-- Connected missionary summary (supporter Profile / Feed when RLS edge cases)
-- ---------------------------------------------------------------------------
create or replace function public.get_connected_missionary_for_supporter()
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  mid uuid;
  result json;
begin
  select pr.connected_missionary_id
  into mid
  from public.profiles pr
  where pr.id = auth.uid();

  if mid is null then
    return null;
  end if;

  select json_build_object(
    'id', p.id,
    'full_name', coalesce(p.full_name, ''),
    'organization', coalesce(p.organization, ''),
    'photo_url', coalesce(p.photo_url, ''),
    'tax_deductible_url', coalesce(p.tax_deductible_url, ''),
    'non_tax_deductible_url', coalesce(p.non_tax_deductible_url, '')
  )
  into result
  from public.profiles p
  where p.id = mid
    and p.role = 'missionary'::public.user_role
  limit 1;

  return result;
end;
$$;

revoke all on function public.get_connected_missionary_for_supporter() from public;
grant execute on function public.get_connected_missionary_for_supporter() to authenticated;

-- ---------------------------------------------------------------------------
-- mission_pushes
-- ---------------------------------------------------------------------------
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
