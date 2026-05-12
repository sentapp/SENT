-- Profile appearance: accent color + public avatars bucket + RPC field for supporters.

alter table public.profiles add column if not exists accent_color text default '#185FA5';

comment on column public.profiles.accent_color is 'Hex UI accent for profile pages and supporter-facing missionary feed.';

-- ---------------------------------------------------------------------------
-- Connected missionary JSON includes accent for supporter feed / Give tab
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
    'non_tax_deductible_url', coalesce(p.non_tax_deductible_url, ''),
    'accent_color', coalesce(nullif(trim(p.accent_color), ''), '#185FA5')
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
-- Storage: public avatars bucket + policies (object key = "{auth.uid()}.ext")
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Users can upload own avatar" on storage.objects;
drop policy if exists "Avatars are publicly readable" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Users can delete own avatar" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '.', 1) = auth.uid()::text
  );

create policy "avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = auth.uid()::text)
  with check (bucket_id = 'avatars' and split_part(name, '.', 1) = auth.uid()::text);

create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = auth.uid()::text);
