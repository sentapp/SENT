-- Post comments (supporter feed) + prayer wall delete / author edit + secure pray increment RPC.

-- ---------------------------------------------------------------------------
-- post_comments
-- ---------------------------------------------------------------------------
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null default '',
  author_display_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_created_idx
  on public.post_comments (post_id, created_at asc);

alter table public.post_comments enable row level security;

-- Denormalize display name so feed readers do not need extra profiles RLS.
create or replace function public.post_comments_fill_author_display()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nm text;
begin
  select nullif(trim(full_name), '') into nm from public.profiles where id = new.author_id;
  new.author_display_name := coalesce(nm, 'Anonymous');
  return new;
end;
$$;

drop trigger if exists post_comments_fill_author_display_trg on public.post_comments;
create trigger post_comments_fill_author_display_trg
  before insert on public.post_comments
  for each row execute procedure public.post_comments_fill_author_display();

drop policy if exists "post_comments_select_authenticated" on public.post_comments;
create policy "post_comments_select_authenticated"
  on public.post_comments for select
  to authenticated
  using (true);

drop policy if exists "post_comments_insert_own" on public.post_comments;
create policy "post_comments_insert_own"
  on public.post_comments for insert
  to authenticated
  with check (author_id = auth.uid());

drop policy if exists "post_comments_update_own" on public.post_comments;
create policy "post_comments_update_own"
  on public.post_comments for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own"
  on public.post_comments for delete
  to authenticated
  using (author_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Prayer wall: delete + author updates; pray count via RPC (replaces broad supporter UPDATE)
-- ---------------------------------------------------------------------------
create or replace function public.increment_prayer_request_prayed_count(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
  mid uuid;
begin
  select missionary_id into mid from public.prayer_requests where id = p_id;
  if mid is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.profiles pr
    where pr.id = auth.uid()
      and (pr.id = mid or pr.connected_missionary_id = mid)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.prayer_requests
  set prayed_count = coalesce(prayed_count, 0) + 1
  where id = p_id
  returning prayed_count into new_count;

  return coalesce(new_count, 0);
end;
$$;

revoke all on function public.increment_prayer_request_prayed_count(uuid) from public;
grant execute on function public.increment_prayer_request_prayed_count(uuid) to authenticated;

drop policy if exists "supporter_update_pray_on_connected_wall" on public.prayer_requests;

drop policy if exists "missionary_delete_prayer_requests" on public.prayer_requests;
create policy "missionary_delete_prayer_requests"
  on public.prayer_requests for delete
  to authenticated
  using (missionary_id = auth.uid());

drop policy if exists "author_delete_own_prayer_request" on public.prayer_requests;
create policy "author_delete_own_prayer_request"
  on public.prayer_requests for delete
  to authenticated
  using (author_id = auth.uid());

drop policy if exists "author_update_own_prayer_request" on public.prayer_requests;
create policy "author_update_own_prayer_request"
  on public.prayer_requests for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
