ALTER TABLE public.trattamenti
  ADD COLUMN IF NOT EXISTS tipo text CHECK (tipo IN ('singolo','ciclo')),
  ADD COLUMN IF NOT EXISTS durata_ciclo_valore integer CHECK (durata_ciclo_valore IS NULL OR durata_ciclo_valore > 0),
  ADD COLUMN IF NOT EXISTS durata_ciclo_unita text CHECK (durata_ciclo_unita IN ('giorni','settimane','mesi')),
  ADD COLUMN IF NOT EXISTS consenso_template_id uuid REFERENCES public.consenso_template(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trattamenti_consenso_template ON public.trattamenti(consenso_template_id);