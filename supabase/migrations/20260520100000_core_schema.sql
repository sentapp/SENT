-- SENT core schema: profiles (user fields), contacts, posts, prayer_requests, communication_logs.
-- Run after 20260510120000_feedback.sql (feedback table already exists).
-- In Supabase Dashboard: Authentication → Providers → Email → configure confirmation as needed for dev.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('missionary', 'supporter');
exception
  when duplicate_object then null;
end $$;

-- Note: 'warm' is retained for backwards compatibility with rows created before
-- the 'potential_partner' value existed. The application maps 'warm' to
-- 'potential_partner' on read; see useSupabaseContacts.mapRow.
do $$ begin
  create type public.contact_category as enum (
    'warm',
    'former',
    'church',
    'supporter',
    'potential_partner'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.contact_status as enum ('prospect', 'asked', 'followup', 'partner', 'declined');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.post_type as enum (
    'field_story',
    'prayer_request',
    'monthly_update',
    'win_testimony'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.communication_type as enum ('call', 'text', 'update', 'prayer', 'note');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles: app user fields (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text not null default '',
  role public.user_role not null default 'supporter',
  phone text default '',
  organization text default '',
  mission_statement text default '',
  location_name text default '',
  latitude double precision,
  longitude double precision,
  photo_url text default '',
  monthly_goal numeric(12, 2) default 0,
  partner_goal integer default 0,
  tax_deductible_url text default '',
  non_tax_deductible_url text default '',
  supporter_code text unique,
  invite_code_used text,
  connected_missionary_id uuid references public.profiles (id) on delete set null,
  notify_in_app boolean not null default true,
  notify_email boolean not null default false,
  notify_text boolean not null default false,
  notify_prayer boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_connected_missionary_idx on public.profiles (connected_missionary_id);

-- ---------------------------------------------------------------------------
-- Contacts (missionary CRM)
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  missionary_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null default '',
  phone text default '',
  email text default '',
  category public.contact_category not null default 'potential_partner',
  status public.contact_status not null default 'prospect',
  monthly_amount numeric(12, 2) default 0,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contacts_missionary_idx on public.contacts (missionary_id);

-- ---------------------------------------------------------------------------
-- Posts (missionary updates → supporter feed)
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  missionary_id uuid not null references public.profiles (id) on delete cascade,
  post_type public.post_type not null default 'field_story',
  location_name text default '',
  latitude double precision,
  longitude double precision,
  body text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists posts_missionary_created_idx on public.posts (missionary_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Prayer requests (wall)
-- ---------------------------------------------------------------------------
create table if not exists public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  missionary_id uuid not null references public.profiles (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  is_anonymous boolean not null default false,
  prayed_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists prayer_requests_missionary_idx on public.prayer_requests (missionary_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Communication log (partner / contact engagement)
-- ---------------------------------------------------------------------------
create table if not exists public.communication_logs (
  id uuid primary key default gen_random_uuid(),
  missionary_id uuid not null references public.profiles (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  comm_type public.communication_type not null,
  notes text default '',
  created_at timestamptz not null default now()
);

create index if not exists communication_logs_missionary_idx on public.communication_logs (missionary_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute procedure public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create profile on signup (reads JWT raw_user_meta_data)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.user_role;
  meta_role text;
begin
  meta_role := coalesce(new.raw_user_meta_data->>'role', 'supporter');
  begin
    r := meta_role::public.user_role;
  exception
    when invalid_text_representation then
      r := 'supporter';
  end;

  insert into public.profiles (id, email, full_name, role, invite_code_used)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    r,
    nullif(trim(coalesce(new.raw_user_meta_data->>'invite_code', '')), '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    role = excluded.role,
    invite_code_used = coalesce(excluded.invite_code_used, public.profiles.invite_code_used);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.posts enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.communication_logs enable row level security;

-- Profiles: own row
drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

-- Supporters can read their connected missionary’s public profile fields (for feed header)
drop policy if exists "Supporters can read connected missionary profile" on public.profiles;
create policy "Supporters can read connected missionary profile"
  on public.profiles for select
  to authenticated
  using (
    id in (
      select connected_missionary_id from public.profiles where id = auth.uid() and connected_missionary_id is not null
    )
  );

-- Contacts: missionary owns
drop policy if exists "Missionary manages own contacts" on public.contacts;
create policy "Missionary manages own contacts"
  on public.contacts for all
  to authenticated
  using (missionary_id = auth.uid())
  with check (missionary_id = auth.uid());

-- Posts: missionary full access; supporters read connected missionary’s posts
drop policy if exists "Missionary manages own posts" on public.posts;
create policy "Missionary manages own posts"
  on public.posts for all
  to authenticated
  using (missionary_id = auth.uid())
  with check (missionary_id = auth.uid());

drop policy if exists "Supporters read connected missionary posts" on public.posts;
create policy "Supporters read connected missionary posts"
  on public.posts for select
  to authenticated
  using (
    missionary_id in (
      select connected_missionary_id from public.profiles where id = auth.uid() and connected_missionary_id is not null
    )
  );

-- Prayer requests: missionary sees all for their ministry; supporters insert/read wall for connected missionary
drop policy if exists "Missionary sees prayer requests for ministry" on public.prayer_requests;
create policy "Missionary sees prayer requests for ministry"
  on public.prayer_requests for select
  to authenticated
  using (missionary_id = auth.uid());

drop policy if exists "Missionary updates prayer counts" on public.prayer_requests;
create policy "Missionary updates prayer counts"
  on public.prayer_requests for update
  to authenticated
  using (missionary_id = auth.uid())
  with check (missionary_id = auth.uid());

drop policy if exists "Supporters read connected missionary prayer wall" on public.prayer_requests;
create policy "Supporters read connected missionary prayer wall"
  on public.prayer_requests for select
  to authenticated
  using (
    missionary_id in (
      select connected_missionary_id from public.profiles where id = auth.uid() and connected_missionary_id is not null
    )
  );

drop policy if exists "Supporters insert prayer on connected wall" on public.prayer_requests;
create policy "Supporters insert prayer on connected wall"
  on public.prayer_requests for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and missionary_id in (
      select connected_missionary_id from public.profiles where id = auth.uid() and connected_missionary_id is not null
    )
  );

drop policy if exists "Supporters update pray count on connected wall" on public.prayer_requests;
create policy "Supporters update pray count on connected wall"
  on public.prayer_requests for update
  to authenticated
  using (
    missionary_id in (
      select connected_missionary_id from public.profiles where id = auth.uid() and connected_missionary_id is not null
    )
  )
  with check (
    missionary_id in (
      select connected_missionary_id from public.profiles where id = auth.uid() and connected_missionary_id is not null
    )
  );

-- Communication logs: missionary only
drop policy if exists "Missionary manages communication logs" on public.communication_logs;
create policy "Missionary manages communication logs"
  on public.communication_logs for all
  to authenticated
  using (missionary_id = auth.uid())
  with check (missionary_id = auth.uid());
