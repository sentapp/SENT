-- Admin role for internal dashboard (profiles.role = 'admin', set manually in Supabase).

do $$ begin
  alter type public.user_role add value if not exists 'admin';
exception
  when duplicate_object then null;
end $$;

create or replace function public.auth_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'::public.user_role
  );
$$;

grant execute on function public.auth_user_is_admin() to authenticated;

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (public.auth_user_is_admin());

drop policy if exists "Admins can read all feedback" on public.feedback;
create policy "Admins can read all feedback"
  on public.feedback
  for select
  to authenticated
  using (public.auth_user_is_admin());
