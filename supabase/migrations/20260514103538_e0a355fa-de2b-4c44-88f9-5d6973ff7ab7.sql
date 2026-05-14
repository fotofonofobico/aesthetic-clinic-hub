-- Multi-studio: predisposizione minima
-- Tabella sedi (studi operativi). Distinta da studio_info (dati legali singolo studio).

CREATE TABLE public.studio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  indirizzo text,
  citta text,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.studio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studi visibili a operatori attivi"
  ON public.studio FOR SELECT TO authenticated
  USING (is_active_operator(auth.uid()));

CREATE POLICY "Solo medici creano studi"
  ON public.studio FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'medico'::app_role));

CREATE POLICY "Solo medici modificano studi"
  ON public.studio FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'medico'::app_role));

CREATE POLICY "Solo medici eliminano studi"
  ON public.studio FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'medico'::app_role));

CREATE TRIGGER trg_studio_updated
  BEFORE UPDATE ON public.studio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed studio di default
INSERT INTO public.studio (nome) VALUES ('Studio principale');

-- Tag studio sul paziente
ALTER TABLE public.pazienti ADD COLUMN studio_id uuid REFERENCES public.studio(id) ON DELETE SET NULL;
CREATE INDEX idx_pazienti_studio ON public.pazienti(studio_id) WHERE studio_id IS NOT NULL;

-- Popola pazienti esistenti con lo studio di default
UPDATE public.pazienti
   SET studio_id = (SELECT id FROM public.studio ORDER BY created_at ASC LIMIT 1)
 WHERE studio_id IS NULL;

-- Studio attivo per utente
ALTER TABLE public.profiles ADD COLUMN studio_attivo_id uuid REFERENCES public.studio(id) ON DELETE SET NULL;