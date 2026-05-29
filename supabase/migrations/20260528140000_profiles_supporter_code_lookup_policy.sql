-- Allow authenticated users to resolve missionaries by public supporter_code (signup / relink fallback).
drop policy if exists "Anyone can look up missionary by supporter code" on public.profiles;

create policy "Anyone can look up missionary by supporter code"
  on public.profiles for select
  to authenticated
  using (
    role = 'missionary'::public.user_role
    and supporter_code is not null
    and trim(supporter_code) <> ''
  );

-- Auto-create CRM contact when a supporter links (insert if no email/name match).
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
  v_name text := trim(coalesce(p_full_name, ''));
  v_email text := trim(coalesce(p_email, ''));
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

  if v_email <> '' then
    select c.id
      into c_id
    from public.contacts c
    where c.missionary_id = p_missionary_id
      and lower(trim(coalesce(c.email, ''))) = lower(v_email)
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
  end if;

  if v_name <> '' then
    select c.id
      into c_id
    from public.contacts c
    where c.missionary_id = p_missionary_id
      and c.full_name ilike v_name
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

    insert into public.contacts (
      missionary_id,
      full_name,
      email,
      category,
      status,
      notes
    )
    values (
      p_missionary_id,
      v_name,
      nullif(v_email, ''),
      'supporter'::public.contact_category,
      'partner'::public.contact_status,
      'Auto-added when supporter connected via SENT invite code.'
    )
    returning id into c_id;

    return json_build_object('ok', true, 'created', true, 'contact_id', c_id);
  end if;

  return json_build_object('ok', true, 'skipped', true);
end;
$$;
