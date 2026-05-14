-- Replace prayer_requests DELETE policies with named policies aligned to product copy.

drop policy if exists "Authors can delete own prayer requests" on public.prayer_requests;
drop policy if exists "Missionaries can delete prayer requests" on public.prayer_requests;
drop policy if exists "missionary_delete_prayer_requests" on public.prayer_requests;
drop policy if exists "author_delete_own_prayer_request" on public.prayer_requests;

create policy "Authors can delete own prayer requests"
on public.prayer_requests for delete
to authenticated
using (author_id = auth.uid());

create policy "Missionaries can delete from own wall"
on public.prayer_requests for delete
to authenticated
using (missionary_id = auth.uid());
