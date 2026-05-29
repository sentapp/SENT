-- Missionaries can read supporter profiles linked via connected_missionary_id (Stats SENT community).
drop policy if exists "Missionaries can read connected supporter profiles" on public.profiles;

create policy "Missionaries can read connected supporter profiles"
  on public.profiles for select
  to authenticated
  using (
    role = 'supporter'::public.user_role
    and connected_missionary_id = auth.uid()
  );
