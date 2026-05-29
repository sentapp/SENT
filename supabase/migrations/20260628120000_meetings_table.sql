CREATE TABLE IF NOT EXISTS public.meetings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  missionary_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts (id) ON DELETE SET NULL,
  contact_name text,
  meeting_date date NOT NULL,
  meeting_time time,
  meeting_type text NOT NULL DEFAULT 'initial',
  outcome text,
  notes text,
  is_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meetings_missionary_date_idx
  ON public.meetings (missionary_id, meeting_date DESC);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Missionaries manage own meetings" ON public.meetings;
CREATE POLICY "Missionaries manage own meetings"
  ON public.meetings FOR ALL
  TO authenticated
  USING (missionary_id = auth.uid())
  WITH CHECK (missionary_id = auth.uid());
