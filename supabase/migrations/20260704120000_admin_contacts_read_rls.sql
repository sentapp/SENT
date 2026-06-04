-- Allow admins to read all contacts (funding totals on admin dashboard).

drop policy if exists "Admins can read all contacts" on public.contacts;
create policy "Admins can read all contacts"
  on public.contacts
  for select
  to authenticated
  using (public.auth_user_is_admin());
