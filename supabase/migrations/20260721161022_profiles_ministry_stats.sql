-- Optional ministry outcome stats shown on missionary Settings and supporter Feed.

alter table public.profiles
  add column if not exists ministry_stats jsonb default '[]'::jsonb;

comment on column public.profiles.ministry_stats is
  'JSON array of {label, value} ministry outcome stats for supporter-facing feed.';

-- Include ministry_stats in connected-missionary RPC for supporters.
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
    'non_tax_deductible_url', coalesce(p.non_tax_deductible_url, ''),
    'accent_color', coalesce(nullif(trim(p.accent_color), ''), '#185FA5'),
    'ministry_stats', coalesce(p.ministry_stats, '[]'::jsonb)
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
