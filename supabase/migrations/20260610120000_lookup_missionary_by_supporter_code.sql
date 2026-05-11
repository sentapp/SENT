-- Allow supporters (and any authenticated user) to resolve a missionary by public invite code
-- without granting SELECT on all missionary profiles. RLS only permits "own row" reads otherwise.

create or replace function public.lookup_missionary_by_supporter_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  want text := upper(trim(coalesce(p_code, '')));
  result json;
begin
  if want = '' then
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
    and upper(trim(p.supporter_code)) = want
  limit 1;

  return result;
end;
$$;

revoke all on function public.lookup_missionary_by_supporter_code(text) from public;
grant execute on function public.lookup_missionary_by_supporter_code(text) to authenticated;
