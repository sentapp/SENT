-- Feedback submissions from missionary and supporter settings.
-- Adjust RLS policies for your auth model (e.g. allow insert for authenticated users).

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  type text not null check (type in ('bug_report', 'feature_request', 'general')),
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Inserts: anonymous users may submit with user_id null; signed-in users should set user_id = auth.uid().
create policy "Anyone can submit feedback"
  on public.feedback
  for insert
  to anon, authenticated
  with check (user_id is null or auth.uid() = user_id);

-- Optional: tighten reads (e.g. admin-only) in the Supabase dashboard.
create policy "Users can read own feedback"
  on public.feedback
  for select
  to authenticated
  using (auth.uid() = user_id);
