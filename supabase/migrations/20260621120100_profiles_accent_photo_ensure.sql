-- Ensures profile appearance columns exist for older / partial databases.
-- Default accent #185FA5 matches app DEFAULT_PROFILE_ACCENT (src/lib/profileAppearance.js) and design token --color-accent.
-- photo_url may already exist from core_schema; IF NOT EXISTS is harmless.

alter table public.profiles add column if not exists accent_color text default '#185FA5';

alter table public.profiles add column if not exists photo_url text;

comment on column public.profiles.accent_color is 'Hex UI accent for profile pages and supporter-facing feed; default aligns with product brand blue.';
