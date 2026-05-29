-- In-app notifications for missionaries + RPC helpers for supporter-triggered inserts.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  missionary_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  related_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_missionary_created_idx
  on public.notifications (missionary_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Missionaries see own notifications" on public.notifications;
create policy "Missionaries see own notifications"
  on public.notifications for all
  to authenticated
  using (missionary_id = auth.uid())
  with check (missionary_id = auth.uid());

-- Realtime: missionaries receive INSERT events for their row filter in the client.
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- create_notification_for_missionary — SECURITY DEFINER (supporters + missionaries)
-- ---------------------------------------------------------------------------
create or replace function public.create_notification_for_missionary(
  p_missionary_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_related_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  nid uuid;
begin
  if p_missionary_id is null or coalesce(trim(p_type), '') = '' or coalesce(trim(p_title), '') = '' then
    return null;
  end if;

  if auth.uid() is distinct from p_missionary_id
     and not exists (
       select 1
       from public.profiles pr
       where pr.id = auth.uid()
         and pr.connected_missionary_id = p_missionary_id
     ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into public.notifications (missionary_id, type, title, body, related_id)
  values (p_missionary_id, trim(p_type), trim(p_title), nullif(trim(coalesce(p_body, '')), ''), p_related_id)
  returning id into nid;

  return nid;
end;
$$;

revoke all on function public.create_notification_for_missionary(uuid, text, text, text, uuid) from public;
grant execute on function public.create_notification_for_missionary(uuid, text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- sync_supporter_to_contacts_for_missionary — match/update/insert + notify
-- ---------------------------------------------------------------------------
create or replace function public.sync_supporter_to_contacts_for_missionary(
  p_missionary_id uuid,
  p_email text,
  p_full_name text,
  p_phone text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c_id uuid;
  c_row public.contacts%rowtype;
  v_email text := trim(coalesce(p_email, ''));
  v_name text := trim(coalesce(p_full_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_title text;
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

  v_title := coalesce(nullif(v_name, ''), 'A supporter');

  if v_email <> '' then
    select c.*
      into c_row
    from public.contacts c
    where c.missionary_id = p_missionary_id
      and c.email ilike v_email
    limit 1;
  end if;

  if c_row.id is null and v_name <> '' then
    select c.*
      into c_row
    from public.contacts c
    where c.missionary_id = p_missionary_id
      and c.full_name ilike v_name
    limit 1;
  end if;

  if c_row.id is not null then
    update public.contacts
    set
      category = 'supporter'::public.contact_category,
      status = 'partner'::public.contact_status,
      email = case
        when trim(coalesce(c_row.email, '')) = '' and v_email <> '' then v_email
        else c_row.email
      end,
      phone = case
        when trim(coalesce(c_row.phone, '')) = '' and v_phone <> '' then v_phone
        else c_row.phone
      end,
      updated_at = now()
    where id = c_row.id;

    perform public.create_notification_for_missionary(
      p_missionary_id,
      'supporter_joined_matched',
      v_title || ' joined as a supporter',
      'Matched to existing contact and updated their record.',
      c_row.id
    );

    return json_build_object('ok', true, 'matched', true, 'contact_id', c_row.id);
  end if;

  if v_name = '' and v_email = '' then
    return json_build_object('ok', true, 'skipped', true);
  end if;

  insert into public.contacts (
    missionary_id,
    full_name,
    email,
    phone,
    category,
    status,
    notes
  )
  values (
    p_missionary_id,
    coalesce(nullif(v_name, ''), 'Supporter'),
    nullif(v_email, ''),
    nullif(v_phone, ''),
    'supporter'::public.contact_category,
    'partner'::public.contact_status,
    'Added automatically when they joined as a supporter on SENT.'
  )
  returning id into c_id;

  perform public.create_notification_for_missionary(
    p_missionary_id,
    'supporter_joined_new',
    v_title || ' joined as a supporter',
    'Added as a new contact in your list.',
    c_id
  );

  return json_build_object('ok', true, 'created', true, 'contact_id', c_id);
end;
$$;

revoke all on function public.sync_supporter_to_contacts_for_missionary(uuid, text, text, text) from public;
grant execute on function public.sync_supporter_to_contacts_for_missionary(uuid, text, text, text) to authenticated;
