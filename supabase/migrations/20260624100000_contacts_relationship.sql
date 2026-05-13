-- Free-form relationship label for CRM (quick tags in UI).
alter table public.contacts
  add column if not exists relationship text;
