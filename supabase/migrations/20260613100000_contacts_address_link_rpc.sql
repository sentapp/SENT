-- Physical mailing / location line for CRM contacts
alter table public.contacts add column if not exists address text;

-- Atomic invite-code link (avoids client SELECT on other users' profiles under RLS)
create or replace function public.link_supporter_by_invite_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  want text := upper(trim(coalesce(p_code, '')));
  mid uuid;
  m_name text;
  m_org text;
begin
  if uid is null then
    return json_build_object('ok', false, 'error', 'Not signed in.');
  end if;

  if want = '' then
    return json_build_object('ok', true, 'skipped', true);
  end if;

  if exists (
    select 1 from public.profiles pr
    where pr.id = uid and pr.connected_missionary_id is not null
  ) then
    return json_build_object('ok', true, 'skipped', true);
  end if;

  select p.id, coalesce(p.full_name, ''), coalesce(p.organization, '')
    into mid, m_name, m_org
  from public.profiles p
  where p.role = 'missionary'::public.user_role
    and p.supporter_code is not null
    and upper(trim(p.supporter_code)) = want
  limit 1;

  if mid is null then
    return json_build_object('ok', false, 'error', 'Code not found — check with your missionary');
  end if;

  update public.profiles
  set connected_missionary_id = mid,
      invite_code_used = want,
      updated_at = now()
  where id = uid;

  return json_build_object(
    'ok', true,
    'missionary', json_build_object(
      'id', mid,
      'full_name', m_name,
      'organization', m_org
    )
  );
end;
$$;

revoke all on function public.link_supporter_by_invite_code(text) from public;
grant execute on function public.link_supporter_by_invite_code(text) to authenticated;
