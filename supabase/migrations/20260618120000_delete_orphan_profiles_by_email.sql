-- Allow signup retry after auth user was removed but a profiles row remained (no matching auth.users id).
-- Callable without a session (anon) so the sign-up page can clean orphans before retrying auth.signUp.

create or replace function public.delete_orphan_profiles_by_email(p_email text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target text := lower(trim(coalesce(p_email, '')));
  n int := 0;
begin
  if target = '' then
    return 0;
  end if;

  delete from public.profiles p
  where lower(trim(coalesce(p.email, ''))) = target
    and not exists (select 1 from auth.users u where u.id = p.id);

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.delete_orphan_profiles_by_email(text) from public;
grant execute on function public.delete_orphan_profiles_by_email(text) to anon;
grant execute on function public.delete_orphan_profiles_by_email(text) to authenticated;
