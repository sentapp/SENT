-- Post photos + community sharing + post-images storage bucket.

alter table public.posts add column if not exists image_url text;
alter table public.posts add column if not exists share_to_community boolean not null default false;

create index if not exists posts_community_created_idx
  on public.posts (created_at desc)
  where share_to_community = true;

-- Community feed: any signed-in user can read shared posts
drop policy if exists "Authenticated read community posts" on public.posts;
create policy "Authenticated read community posts"
  on public.posts for select
  to authenticated
  using (share_to_community = true);

-- Community feed: read missionary profile fields on joined posts
drop policy if exists "Authenticated read missionary profiles for community" on public.profiles;
create policy "Authenticated read missionary profiles for community"
  on public.profiles for select
  to authenticated
  using (role = 'missionary'::public.user_role);

-- Reactions on community posts (any authenticated user)
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
    or exists (
      select 1 from public.posts p where p.id = post_reactions.post_id and p.share_to_community = true
    )
  );

drop policy if exists "Supporters insert own reactions" on public.post_reactions;
create policy "Supporters insert own reactions"
  on public.post_reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1
        from public.posts p
        join public.profiles pr on pr.id = auth.uid()
        where p.id = post_reactions.post_id
          and pr.connected_missionary_id is not null
          and p.missionary_id = pr.connected_missionary_id
      )
      or exists (
        select 1 from public.posts p where p.id = post_reactions.post_id and p.share_to_community = true
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: public post-images bucket (object key = "{auth.uid()}/…")
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "post_images_insert_own" on storage.objects;
drop policy if exists "post_images_public_read" on storage.objects;
drop policy if exists "post_images_update_own" on storage.objects;
drop policy if exists "post_images_delete_own" on storage.objects;

create policy "post_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'post-images');

create policy "post_images_update_own"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "post_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
