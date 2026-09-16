-- First-run onboarding. New signups stay incomplete (DEFAULT false).
-- handle_new_user inserts id/email/full_name/role/invite_code_used only, so it does not
-- set onboarding_complete and new profiles keep the column default.
-- Client upserts also omit this column, so they neither force true on insert nor overwrite it on conflict.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean DEFAULT false;

-- Mission field for the missionary details step. No other table changes.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mission_field text DEFAULT '';

-- Existing accounts skip the flow. Rows created after this UPDATE keep DEFAULT false.
UPDATE public.profiles
SET onboarding_complete = true
WHERE onboarding_complete IS DISTINCT FROM true;

COMMENT ON COLUMN public.profiles.onboarding_complete IS
  'False only for profiles created after this migration. Existing rows are set true so they are not sent through first-run onboarding.';

COMMENT ON COLUMN public.profiles.mission_field IS
  'Free-text mission field collected during first-run onboarding.';
