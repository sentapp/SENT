-- Contacts: enforce missionary isolation at the database (matches app queries using missionary_id = auth.uid()).
-- Replaces legacy policy name with the canonical "Missionaries can only see own contacts" policy.

drop policy if exists "Missionary manages own contacts" on public.contacts;
drop policy if exists "Missionaries can only see own contacts" on public.contacts;

create policy "Missionaries can only see own contacts"
  on public.contacts for all
  to authenticated
  using (missionary_id = auth.uid())
  with check (missionary_id = auth.uid());
