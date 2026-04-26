-- 1. Pulizia totale dati clinici (in ordine per le foreign key)
DELETE FROM public.anamnesi_flag_rischio;
DELETE FROM public.paziente_alert;
DELETE FROM public.paziente_nota;
DELETE FROM public.followup;
DELETE FROM public.seduta;
DELETE FROM public.piano_trattamento;
DELETE FROM public.consenso_firmato;
DELETE FROM public.paziente_access_log;
DELETE FROM public.anamnesi;
DELETE FROM public.pazienti;

-- 2. Drop colonne anamnesi obsolete
ALTER TABLE public.anamnesi
  DROP COLUMN IF EXISTS abitudini,
  DROP COLUMN IF EXISTS ostetrica,
  DROP COLUMN IF EXISTS allergologica;

-- 3. Tabella anamnesi_versione (snapshot immutabili)
CREATE TABLE IF NOT EXISTS public.anamnesi_versione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anamnesi_id uuid NOT NULL,
  paziente_id uuid NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX IF NOT EXISTS idx_anamnesi_versione_paziente
  ON public.anamnesi_versione(paziente_id, created_at DESC);

ALTER TABLE public.anamnesi_versione ENABLE ROW LEVEL SECURITY;

-- RLS: lettura per operatori attivi, scrittura solo via trigger (no UPDATE/DELETE)
CREATE POLICY "Versioni visibili a operatori attivi"
  ON public.anamnesi_versione FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Versioni inseribili da operatori attivi"
  ON public.anamnesi_versione FOR INSERT TO authenticated
  WITH CHECK (public.is_active_operator(auth.uid()));

-- (nessuna policy UPDATE/DELETE → immutabili)

-- 4. Trigger: ad ogni UPDATE su anamnesi salva snapshot del PRECEDENTE
CREATE OR REPLACE FUNCTION public.archive_anamnesi_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.anamnesi_versione (
    anamnesi_id,
    paziente_id,
    snapshot,
    created_by
  ) VALUES (
    OLD.id,
    OLD.paziente_id,
    jsonb_build_object(
      'generale', OLD.generale,
      'patologica', OLD.patologica,
      'farmacologica', OLD.farmacologica,
      'estetica', OLD.estetica,
      'note_libere', OLD.note_libere,
      'updated_at', OLD.updated_at
    ),
    OLD.compilata_da
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_anamnesi_version ON public.anamnesi;
CREATE TRIGGER trg_archive_anamnesi_version
  BEFORE UPDATE ON public.anamnesi
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_anamnesi_version();