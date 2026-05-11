-- Add CRM category "potential" (potential supporters). Map legacy enum labels into it.
-- Requires PostgreSQL 15+ for ADD VALUE IF NOT EXISTS (Supabase default).

alter type public.contact_category add value if not exists 'potential';

-- Rewrite legacy labels to the new canonical value
update public.contacts
set category = 'potential'::public.contact_category
where category in (
  'warm'::public.contact_category,
  'potential_partner'::public.contact_category
);

alter table public.contacts
  alter column category set default 'potential'::public.contact_category;
