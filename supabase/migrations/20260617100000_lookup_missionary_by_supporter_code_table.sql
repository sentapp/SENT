-- Invite code lookup: return TABLE + param name `code` for PostgREST (.rpc({ code })).
-- Fixes supporters blocked by RLS when resolving a missionary before they are linked.
-- Shared normalization matches client normalizeMissionaryInviteCode (unicode dashes → hyphen, strip spaces, uppercase).

create or replace function public.normalize_supporter_invite_code(input text)
returns text
language sql
immutable
set search_path = public
as $$
  select upper(
    regexp_replace(
      regexp_replace(
        trim(coalesce(input, '')),
        e'[\u2013\u2014\u2212]',
        '-',
        'g'
      ),
      '\s+',
      '',
      'g'
    )
  );
$$;

revoke all on function public.normalize_supporter_invite_code(text) from public;
grant execute on function public.normalize_supporter_invite_code(text) to authenticated;

-- Replace return type: must drop first (was json in prior migrations).
drop function if exists public.lookup_missionary_by_supporter_code(text);

create function public.lookup_missionary_by_supporter_code(code text)
returns table (id uuid, full_name text, organization text)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    coalesce(p.full_name, '')::text,
    coalesce(p.organization, '')::text
  from public.profiles p
  where p.role = 'missionary'::public.user_role
    and p.supporter_code is not null
    and trim(p.supporter_code) <> ''
    and public.normalize_supporter_invite_code(p.supporter_code)
      = public.normalize_supporter_invite_code(code)
  limit 1;
$$;

revoke all on function public.lookup_missionary_by_supporter_code(text) from public;
grant execute on function public.lookup_missionary_by_supporter_code(text) to authenticated;

-- Keep atomic link RPC in sync with the same normalization.
create or replace function public.link_supporter_by_invite_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  want text;
  mid uuid;
  m_name text;
  m_org text;
begin
  want := public.normalize_supporter_invite_code(p_code);

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
    and trim(p.supporter_code) <> ''
    and public.normalize_supporter_invite_code(p.supporter_code) = want
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
