-- Allow authenticated users to insert their own profile row (signup upsert fallback if trigger lags).
-- Required for client-side profiles upsert after auth.signUp.

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());
