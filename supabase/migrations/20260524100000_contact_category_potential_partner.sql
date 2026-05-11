-- Add the "potential_partner" value to contact_category, plus a defensive
-- re-add of "supporter" so this file is safe to run even when the prior
-- 20260522100000_contact_category_supporter.sql migration is missing.
--
-- Apply order (assumed):
--   1. 20260520100000_core_schema.sql                  (creates enum + table)
--   2. 20260522100000_contact_category_supporter.sql   (adds 'supporter')
--   3. THIS FILE                                       (adds 'potential_partner')
--
-- Why this pattern instead of `ALTER TYPE ... ADD VALUE IF NOT EXISTS`:
--   `IF NOT EXISTS` for `ADD VALUE` was only added in PostgreSQL 9.6, and even
--   on supported versions some managed environments reject it. The pg_enum
--   guard below works on every modern Postgres version Supabase has shipped.
--
-- Note on legacy 'warm' rows: no destructive data migration is performed here.
-- The application maps 'warm' -> 'potential_partner' on read and rewrites the
-- value the next time the contact is saved, so the legacy enum value is left
-- in place to keep historical rows valid.
--
-- Note on the column default: we intentionally do NOT change the
-- public.contacts.category default in the same migration as `ADD VALUE`,
-- because Postgres forbids referencing a newly-added enum value inside the
-- same transaction. Application inserts always specify `category` explicitly
-- (`category: 'potential_partner'`), so the column default does not affect
-- normal app behavior. To migrate the default in the database, run the
-- following statement separately AFTER this migration commits:
--
--   alter table public.contacts
--     alter column category set default 'potential_partner'::public.contact_category;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'contact_category'
      and e.enumlabel = 'supporter'
  ) then
    alter type public.contact_category add value 'supporter';
  end if;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'contact_category'
      and e.enumlabel = 'potential_partner'
  ) then
    alter type public.contact_category add value 'potential_partner';
  end if;
end$$;
