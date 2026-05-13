-- Make `contacts.category` optional (NULL) and remap legacy "potential" / pre-rename
-- enum labels into NULL so the UI no longer shows a default "Potential" / "My Network"
-- category for uncategorized contacts.
--
-- Why this migration is non-destructive:
--   Postgres does **not** support removing values from an existing enum type without
--   recreating the whole type (and rewriting every dependent column / index). Instead,
--   the application stops *writing* legacy values ('potential', 'warm', 'potential_partner')
--   and this migration *rewrites existing rows* that hold those labels to NULL so they
--   render with no category pill. The enum labels remain in the type as dead values.
--
-- Apply order (assumed):
--   1. 20260520100000_core_schema.sql                          (creates enum + table)
--   2. 20260522100000_contact_category_supporter.sql            (adds 'supporter')
--   3. 20260524100000_contact_category_potential_partner.sql    (adds 'potential_partner')
--   4. 20260611120000_contact_category_potential.sql            (adds 'potential' + sets default)
--   5. THIS FILE                                                (NULL out legacy categories + drop NOT NULL)

-- 1. Drop the NOT NULL constraint on contacts.category so uncategorized contacts can be saved as NULL.
alter table public.contacts
  alter column category drop not null;

-- 2. Drop the column default so new inserts without `category` default to NULL (no longer 'potential').
alter table public.contacts
  alter column category drop default;

-- 3. Rewrite any rows still on legacy "potential" labels to NULL.
--    Casting to text first keeps this safe regardless of which enum labels currently exist:
--    rows whose label matches in any case / surrounding whitespace are nulled out.
update public.contacts
set category = null
where category is not null
  and lower(trim(category::text)) in ('potential', 'warm', 'potential_partner');
