CREATE TABLE IF NOT EXISTS public.meeting_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  missionary_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_name text,
  requested_date date NOT NULL,
  message text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.meeting_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Supporters can insert requests" ON public.meeting_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Missionaries can read own requests" ON public.meeting_requests
  FOR SELECT TO authenticated
  USING (missionary_id = auth.uid() OR requester_id = auth.uid());

CREATE POLICY "Missionaries can update own requests" ON public.meeting_requests
  FOR UPDATE TO authenticated
  USING (missionary_id = auth.uid());
