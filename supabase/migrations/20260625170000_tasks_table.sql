CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  missionary_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  title text NOT NULL,
  notes text,
  due_date date,
  is_complete boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tasks_missionary_due_idx ON public.tasks (missionary_id, due_date);
CREATE INDEX IF NOT EXISTS tasks_contact_idx ON public.tasks (contact_id) WHERE contact_id IS NOT NULL;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Missionaries manage own tasks" ON public.tasks;
CREATE POLICY "Missionaries manage own tasks"
  ON public.tasks FOR ALL TO authenticated
  USING (missionary_id = auth.uid())
  WITH CHECK (missionary_id = auth.uid());
