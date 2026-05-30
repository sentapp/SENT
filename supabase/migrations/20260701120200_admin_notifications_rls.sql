-- Allow admins to read all notifications (overview activity feed) and insert blast notifications.

drop policy if exists "Admins can read all notifications" on public.notifications;
create policy "Admins can read all notifications"
  on public.notifications
  for select
  to authenticated
  using (public.auth_user_is_admin());

drop policy if exists "Admins can insert notifications" on public.notifications;
create policy "Admins can insert notifications"
  on public.notifications
  for insert
  to authenticated
  with check (public.auth_user_is_admin());
