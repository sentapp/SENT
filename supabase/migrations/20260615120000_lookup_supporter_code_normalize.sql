-- Normalize invite codes for lookup: trim, uppercase, ASCII hyphen, strip spaces (matches client-side normalizeMissionaryInviteCode).

create or replace function public.lookup_missionary_by_supporter_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  norm_input text;
  result json;
begin
  norm_input := upper(
    regexp_replace(
      regexp_replace(
        trim(coalesce(p_code, '')),
        E'[\u2013\u2014\u2212]',
        '-',
        'g'
      ),
      '\s+',
      '',
      'g'
    )
  );

  if norm_input = '' then
    return null;
  end if;

  select json_build_object(
    'id', p.id,
    'full_name', coalesce(p.full_name, ''),
    'organization', coalesce(p.organization, ''),
    'supporter_code', p.supporter_code
  )
  into result
  from public.profiles p
  where p.role = 'missionary'::public.user_role
    and p.supporter_code is not null
    and trim(p.supporter_code) <> ''
    and upper(
      regexp_replace(
        regexp_replace(
          trim(p.supporter_code),
          E'[\u2013\u2014\u2212]',
          '-',
          'g'
        ),
        '\s+',
        '',
        'g'
      )
    ) = norm_input
  limit 1;

  return result;
end;
$$;

-- Same normalization for atomic signup/link RPC used during supporter registration.

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
  want := upper(
    regexp_replace(
      regexp_replace(trim(coalesce(p_code, '')), E'[\u2013\u2014\u2212]', '-', 'g'),
      '\s+',
      '',
      'g'
    )
  );

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
    and upper(
      regexp_replace(
        regexp_replace(trim(p.supporter_code), E'[\u2013\u2014\u2212]', '-', 'g'),
        '\s+',
        '',
        'g'
      )
    ) = want
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
