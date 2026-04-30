
-- =========================================================================
-- 1. ARCHIVIO UNIFICATO: archiviato_il su entità di catalogo
-- =========================================================================
ALTER TABLE public.prodotto          ADD COLUMN IF NOT EXISTS archiviato_il timestamptz;
ALTER TABLE public.trattamenti       ADD COLUMN IF NOT EXISTS archiviato_il timestamptz;
ALTER TABLE public.consenso_template ADD COLUMN IF NOT EXISTS archiviato_il timestamptz;

CREATE INDEX IF NOT EXISTS prodotto_attivi_idx
  ON public.prodotto(id) WHERE archiviato_il IS NULL;
CREATE INDEX IF NOT EXISTS trattamenti_attivi_idx
  ON public.trattamenti(id) WHERE archiviato_il IS NULL;
CREATE INDEX IF NOT EXISTS consenso_template_attivi_idx
  ON public.consenso_template(id) WHERE archiviato_il IS NULL;

-- =========================================================================
-- 2. ANNULLAMENTO PIANO: cancella sedute non erogate
-- =========================================================================
CREATE OR REPLACE FUNCTION public.piano_annulla_sedute_pendenti()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.stato = 'annullato' AND COALESCE(OLD.stato::text, '') <> 'annullato' THEN
    DELETE FROM public.seduta
     WHERE piano_id = NEW.id
       AND completata = false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_piano_annulla_sedute ON public.piano_trattamento;
CREATE TRIGGER trg_piano_annulla_sedute
AFTER UPDATE OF stato ON public.piano_trattamento
FOR EACH ROW
EXECUTE FUNCTION public.piano_annulla_sedute_pendenti();

-- =========================================================================
-- 3. CONSENSO TEMPLATE: bump versione automatico
-- =========================================================================
CREATE OR REPLACE FUNCTION public.consenso_template_bump_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  cur text;
  major_part text;
  minor_part text;
  minor_int int;
  changed boolean;
BEGIN
  changed := (NEW.titolo IS DISTINCT FROM OLD.titolo)
          OR (NEW.testo IS DISTINCT FROM OLD.testo)
          OR (NEW.categoria IS DISTINCT FROM OLD.categoria)
          OR (NEW.durata_tipo IS DISTINCT FROM OLD.durata_tipo)
          OR (NEW.durata_sedute IS DISTINCT FROM OLD.durata_sedute)
          OR (NEW.validita_mesi IS DISTINCT FROM OLD.validita_mesi)
          OR (NEW.richiede_firma_medico IS DISTINCT FROM OLD.richiede_firma_medico);

  IF NOT changed THEN
    RETURN NEW;
  END IF;

  -- Se l'utente ha già modificato manualmente la versione in questa stessa UPDATE, rispettiamo
  IF NEW.versione IS DISTINCT FROM OLD.versione THEN
    RETURN NEW;
  END IF;

  cur := COALESCE(OLD.versione, '1.0');

  IF cur ~ '^\d+\.\d+$' THEN
    major_part := split_part(cur, '.', 1);
    minor_part := split_part(cur, '.', 2);
    minor_int := minor_part::int + 1;
    NEW.versione := major_part || '.' || minor_int::text;
  ELSIF cur ~ '^\d+$' THEN
    NEW.versione := cur || '.1';
  ELSE
    -- formato non standard: appendiamo .1
    NEW.versione := cur || '.1';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consenso_template_bump_version ON public.consenso_template;
CREATE TRIGGER trg_consenso_template_bump_version
BEFORE UPDATE ON public.consenso_template
FOR EACH ROW
EXECUTE FUNCTION public.consenso_template_bump_version();

-- =========================================================================
-- 4. DIARIO: allegati su paziente_nota
-- =========================================================================
ALTER TABLE public.paziente_nota
  ADD COLUMN IF NOT EXISTS allegati jsonb NOT NULL DEFAULT '[]'::jsonb;

-- =========================================================================
-- 5. STORAGE: bucket nota-allegati (privato)
-- =========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('nota-allegati', 'nota-allegati', false)
ON CONFLICT (id) DO NOTHING;

-- Policy SELECT: operatori attivi
DROP POLICY IF EXISTS "Allegati nota leggibili da operatori attivi" ON storage.objects;
CREATE POLICY "Allegati nota leggibili da operatori attivi"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'nota-allegati' AND public.is_active_operator(auth.uid()));

-- Policy INSERT: operatori attivi
DROP POLICY IF EXISTS "Allegati nota caricabili da operatori attivi" ON storage.objects;
CREATE POLICY "Allegati nota caricabili da operatori attivi"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'nota-allegati' AND public.is_active_operator(auth.uid()));

-- Policy UPDATE: operatori attivi
DROP POLICY IF EXISTS "Allegati nota aggiornabili da operatori attivi" ON storage.objects;
CREATE POLICY "Allegati nota aggiornabili da operatori attivi"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'nota-allegati' AND public.is_active_operator(auth.uid()));

-- Policy DELETE: solo medici
DROP POLICY IF EXISTS "Allegati nota eliminabili solo da medici" ON storage.objects;
CREATE POLICY "Allegati nota eliminabili solo da medici"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'nota-allegati' AND public.has_role(auth.uid(), 'medico'::app_role));
