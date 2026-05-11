-- Prayer wall: RLS aligned with app (author_id + missionary_id on insert; read for authenticated; missionary + supporter pray updates).
-- Contact CRM: link supporter to existing missionary contact by email/name (SECURITY DEFINER; verifies supporter is linked to missionary).

-- ---------------------------------------------------------------------------
-- prayer_requests policies
-- ---------------------------------------------------------------------------
drop policy if exists "insert_own_prayer_request" on public.prayer_requests;
drop policy if exists "read_prayer_requests" on public.prayer_requests;
drop policy if exists "missionary_full_access" on public.prayer_requests;

drop policy if exists "Missionary sees prayer requests for ministry" on public.prayer_requests;
drop policy if exists "Missionary updates prayer counts" on public.prayer_requests;
drop policy if exists "Supporters read connected missionary prayer wall" on public.prayer_requests;
drop policy if exists "Supporters insert prayer on connected wall" on public.prayer_requests;
drop policy if exists "Supporters update pray count on connected wall" on public.prayer_requests;

alter table public.prayer_requests disable row level security;
alter table public.prayer_requests enable row level security;

create policy "authenticated_insert_prayer"
  on public.prayer_requests for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and missionary_id in (
      select pr.connected_missionary_id
      from public.profiles pr
      where pr.id = auth.uid()
        and pr.connected_missionary_id is not null
    )
  );

create policy "authenticated_read_prayer"
  on public.prayer_requests for select
  to authenticated
  using (true);

create policy "missionary_manage_prayer"
  on public.prayer_requests for update
  to authenticated
  using (missionary_id = auth.uid())
  with check (missionary_id = auth.uid());

create policy "supporter_update_pray_on_connected_wall"
  on public.prayer_requests for update
  to authenticated
  using (
    missionary_id in (
      select connected_missionary_id
      from public.profiles
      where id = auth.uid()
        and connected_missionary_id is not null
    )
  )
  with check (
    missionary_id in (
      select connected_missionary_id
      from public.profiles
      where id = auth.uid()
        and connected_missionary_id is not null
    )
  );

-- ---------------------------------------------------------------------------
-- Link supporter signup to missionary CRM contact (bypasses contacts RLS)
-- ---------------------------------------------------------------------------
create or replace function public.link_supporter_to_contact_for_missionary(
  p_missionary_id uuid,
  p_email text,
  p_full_name text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c_id uuid;
begin
  if p_missionary_id is null then
    return json_build_object('ok', false, 'error', 'missing_missionary');
  end if;

  if not exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and pr.connected_missionary_id = p_missionary_id
  ) then
    return json_build_object('ok', false, 'error', 'not_linked');
  end if;

  select c.id
    into c_id
  from public.contacts c
  where c.missionary_id = p_missionary_id
    and trim(coalesce(c.email, '')) <> ''
    and lower(trim(c.email)) = lower(trim(coalesce(p_email, '')))
  limit 1;

  if c_id is not null then
    update public.contacts
    set
      category = 'supporter'::public.contact_category,
      status = 'partner'::public.contact_status,
      updated_at = now()
    where id = c_id;
    return json_build_object('ok', true, 'matched', 'email');
  end if;

  if trim(coalesce(p_full_name, '')) <> '' then
    select c.id
      into c_id
    from public.contacts c
    where c.missionary_id = p_missionary_id
      and lower(trim(c.full_name)) = lower(trim(coalesce(p_full_name, '')))
    limit 1;

    if c_id is not null then
      update public.contacts
      set
        category = 'supporter'::public.contact_category,
        status = 'partner'::public.contact_status,
        updated_at = now()
      where id = c_id;
      return json_build_object('ok', true, 'matched', 'name');
    end if;
  end if;

  return json_build_object('ok', true, 'skipped', true);
end;
$$;

revoke all on function public.link_supporter_to_contact_for_missionary(uuid, text, text) from public;
grant execute on function public.link_supporter_to_contact_for_missionary(uuid, text, text) to authenticated;
