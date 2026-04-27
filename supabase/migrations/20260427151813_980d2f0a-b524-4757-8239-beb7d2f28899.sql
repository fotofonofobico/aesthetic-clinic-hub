-- ============= TEMPLATE: categoria, validità, descrizione =============
CREATE TYPE consenso_categoria AS ENUM (
  'gdpr_generale',
  'trattamento_singolo',
  'trattamento_continuativo',
  'altro'
);

ALTER TABLE public.consenso_template
  ADD COLUMN categoria consenso_categoria NOT NULL DEFAULT 'altro',
  ADD COLUMN validita_mesi integer,
  ADD COLUMN descrizione text;

-- trigger updated_at
DROP TRIGGER IF EXISTS trg_consenso_template_updated_at ON public.consenso_template;
CREATE TRIGGER trg_consenso_template_updated_at
  BEFORE UPDATE ON public.consenso_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= FIRMATO: modalità firma, PDF, validità, revoca =============
CREATE TYPE consenso_modalita_firma AS ENUM ('tablet', 'pdf_caricato');

ALTER TABLE public.consenso_firmato
  ADD COLUMN modalita_firma consenso_modalita_firma NOT NULL DEFAULT 'tablet',
  ADD COLUMN pdf_url text,
  ADD COLUMN categoria_snapshot consenso_categoria NOT NULL DEFAULT 'altro',
  ADD COLUMN validita_mesi_snapshot integer,
  ADD COLUMN valido_fino_a timestamptz,
  ADD COLUMN revocato_il timestamptz,
  ADD COLUMN revocato_da uuid;

-- la firma_immagine non è più obbligatoria (può essere PDF)
ALTER TABLE public.consenso_firmato ALTER COLUMN firma_immagine DROP NOT NULL;

-- ============= FUNZIONE: stato consenso =============
-- Verifica esistenza di un consenso valido per un dato template
CREATE OR REPLACE FUNCTION public.has_consenso_valido(
  _paziente_id uuid,
  _template_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consenso_firmato cf
    JOIN public.consenso_template ct ON ct.id = cf.template_id
    WHERE cf.paziente_id = _paziente_id
      AND cf.template_id = _template_id
      AND cf.revocato_il IS NULL
      AND cf.versione_snapshot = ct.versione
      AND ct.attivo = true
      AND (cf.valido_fino_a IS NULL OR cf.valido_fino_a > now())
  )
$$;

-- Ritorna lo stato di tutti i consensi firmati per un paziente
CREATE OR REPLACE FUNCTION public.paziente_consensi_stato(_paziente_id uuid)
RETURNS TABLE (
  consenso_id uuid,
  template_id uuid,
  titolo text,
  versione text,
  categoria consenso_categoria,
  firmato_il timestamptz,
  valido_fino_a timestamptz,
  stato text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cf.id,
    cf.template_id,
    cf.titolo_snapshot,
    cf.versione_snapshot,
    cf.categoria_snapshot,
    cf.firmato_il,
    cf.valido_fino_a,
    CASE
      WHEN cf.revocato_il IS NOT NULL THEN 'revocato'
      WHEN cf.valido_fino_a IS NOT NULL AND cf.valido_fino_a <= now() THEN 'scaduto'
      WHEN ct.id IS NULL OR ct.attivo = false THEN 'obsoleto'
      WHEN ct.versione <> cf.versione_snapshot THEN 'obsoleto'
      ELSE 'valido'
    END AS stato
  FROM public.consenso_firmato cf
  LEFT JOIN public.consenso_template ct ON ct.id = cf.template_id
  WHERE cf.paziente_id = _paziente_id
  ORDER BY cf.firmato_il DESC
$$;

-- ============= STORAGE BUCKET per PDF =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('consensi-pdf', 'consensi-pdf', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Operatori attivi vedono PDF consensi"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'consensi-pdf' AND public.is_active_operator(auth.uid()));

CREATE POLICY "Operatori attivi caricano PDF consensi"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'consensi-pdf' AND public.is_active_operator(auth.uid()));

CREATE POLICY "Solo medici eliminano PDF consensi"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'consensi-pdf' AND public.has_role(auth.uid(), 'medico'));

-- ============= UPDATE: revoca consenso (era solo INSERT/SELECT/DELETE) =============
CREATE POLICY "Solo medici revocano consensi firmati"
ON public.consenso_firmato FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'medico'));