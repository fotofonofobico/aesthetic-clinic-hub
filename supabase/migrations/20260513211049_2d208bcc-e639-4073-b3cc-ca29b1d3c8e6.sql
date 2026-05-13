CREATE TABLE public.paziente_misurazione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paziente_id uuid NOT NULL,
  seduta_id uuid,
  data_rilevazione date NOT NULL DEFAULT CURRENT_DATE,
  peso_kg numeric,
  misure jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.paziente_misurazione ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Misurazioni visibili a operatori attivi"
ON public.paziente_misurazione FOR SELECT TO authenticated
USING (is_active_operator(auth.uid()));

CREATE POLICY "Misurazioni creabili da operatori attivi"
ON public.paziente_misurazione FOR INSERT TO authenticated
WITH CHECK (is_active_operator(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Misurazioni modificabili da operatori attivi"
ON public.paziente_misurazione FOR UPDATE TO authenticated
USING (is_active_operator(auth.uid()));

CREATE POLICY "Solo medici eliminano misurazioni"
ON public.paziente_misurazione FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'medico'::app_role));

CREATE INDEX paziente_misurazione_paziente_data_idx
  ON public.paziente_misurazione (paziente_id, data_rilevazione DESC);