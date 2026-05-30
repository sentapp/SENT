ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mission_start_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mission_end_date date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS daily_outreach_goal integer DEFAULT 16;
