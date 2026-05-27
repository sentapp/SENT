-- Multi-currency: per-contact amounts and missionary home currency for dashboard totals.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS home_currency text DEFAULT 'USD';

COMMENT ON COLUMN public.contacts.currency IS 'ISO-style currency code for monthly and one-time gift amounts (e.g. USD, GBP).';
COMMENT ON COLUMN public.profiles.home_currency IS 'Missionary default currency for dashboard totals and new contacts.';
