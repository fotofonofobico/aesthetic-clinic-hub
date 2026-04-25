-- 1. Anagrafica estesa
ALTER TABLE public.pazienti
  ADD COLUMN IF NOT EXISTS identita_genere text,
  ADD COLUMN IF NOT EXISTS peso_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS altezza_cm integer;

-- 2. Tipo nota
DO $$ BEGIN
  CREATE TYPE public.nota_tipo AS ENUM ('clinica', 'telefonata', 'promemoria', 'altro');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Tabella note diario
CREATE TABLE IF NOT EXISTS public.paziente_nota (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paziente_id uuid NOT NULL,
  tipo public.nota_tipo NOT NULL DEFAULT 'clinica',
  testo text NOT NULL,
  data_evento timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paziente_nota_paziente ON public.paziente_nota(paziente_id, data_evento DESC);

ALTER TABLE public.paziente_nota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Note visibili a operatori attivi"
  ON public.paziente_nota FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Note creabili da operatori attivi"
  ON public.paziente_nota FOR INSERT TO authenticated
  WITH CHECK (public.is_active_operator(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Note modificabili da operatori attivi"
  ON public.paziente_nota FOR UPDATE TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Solo medici eliminano note"
  ON public.paziente_nota FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'medico'::app_role));

CREATE TRIGGER trg_paziente_nota_updated
  BEFORE UPDATE ON public.paziente_nota
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();