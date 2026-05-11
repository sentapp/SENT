-- Post reactions (supporter heart / pray on missionary posts)
create table if not exists public.post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('heart', 'pray')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, kind)
);

create index if not exists post_reactions_post_idx on public.post_reactions (post_id);
create index if not exists post_reactions_user_idx on public.post_reactions (user_id);

alter table public.post_reactions enable row level security;

drop policy if exists "Supporters read reactions on connected posts" on public.post_reactions;
create policy "Supporters read reactions on connected posts"
  on public.post_reactions for select
  to authenticated
  using (
    exists (
      select 1
      from public.posts p
      join public.profiles pr on pr.id = auth.uid()
      where p.id = post_reactions.post_id
        and pr.connected_missionary_id is not null
        and p.missionary_id = pr.connected_missionary_id
    )
    or exists (
      select 1 from public.posts p where p.id = post_reactions.post_id and p.missionary_id = auth.uid()
    )
  );

drop policy if exists "Supporters insert own reactions" on public.post_reactions;
create policy "Supporters insert own reactions"
  on public.post_reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.posts p
      join public.profiles pr on pr.id = auth.uid()
      where p.id = post_reactions.post_id
        and pr.connected_missionary_id is not null
        and p.missionary_id = pr.connected_missionary_id
    )
  );

drop policy if exists "Supporters delete own reactions" on public.post_reactions;
create policy "Supporters delete own reactions"
  on public.post_reactions for delete
  to authenticated
  using (user_id = auth.uid());
