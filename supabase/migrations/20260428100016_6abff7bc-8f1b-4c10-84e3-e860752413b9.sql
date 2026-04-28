
-- consenso_template
ALTER TABLE public.consenso_template
  ADD COLUMN IF NOT EXISTS richiede_firma_medico boolean NOT NULL DEFAULT false;

-- consenso_firmato
ALTER TABLE public.consenso_firmato
  ADD COLUMN IF NOT EXISTS firma_medico_immagine text,
  ADD COLUMN IF NOT EXISTS firmato_da_medico uuid,
  ADD COLUMN IF NOT EXISTS seduta_id uuid,
  ADD COLUMN IF NOT EXISTS pdf_generato_url text,
  ADD COLUMN IF NOT EXISTS rifiutato boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.consenso_firmato_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.titolo_snapshot IS DISTINCT FROM OLD.titolo_snapshot
      OR NEW.testo_snapshot IS DISTINCT FROM OLD.testo_snapshot
      OR NEW.versione_snapshot IS DISTINCT FROM OLD.versione_snapshot
      OR NEW.firma_immagine IS DISTINCT FROM OLD.firma_immagine
      OR NEW.firmato_il IS DISTINCT FROM OLD.firmato_il
      OR NEW.hash_integrita IS DISTINCT FROM OLD.hash_integrita
      OR NEW.paziente_id IS DISTINCT FROM OLD.paziente_id
      OR NEW.template_id IS DISTINCT FROM OLD.template_id
      OR NEW.modalita_firma IS DISTINCT FROM OLD.modalita_firma
      OR NEW.rifiutato IS DISTINCT FROM OLD.rifiutato) THEN
    RAISE EXCEPTION 'Consenso firmato immutabile: ammesse solo operazioni di revoca';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consenso_firmato_immutable ON public.consenso_firmato;
CREATE TRIGGER trg_consenso_firmato_immutable
  BEFORE UPDATE ON public.consenso_firmato
  FOR EACH ROW EXECUTE FUNCTION public.consenso_firmato_immutable();

-- anamnesi
ALTER TABLE public.anamnesi
  ADD COLUMN IF NOT EXISTS stato public.anamnesi_stato NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS firmata_il timestamptz,
  ADD COLUMN IF NOT EXISTS firma_paziente text,
  ADD COLUMN IF NOT EXISTS firma_medico text,
  ADD COLUMN IF NOT EXISTS firmata_da_medico uuid,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS hash_integrita text,
  ADD COLUMN IF NOT EXISTS versione_numero integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.anamnesi_signed_protect()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.stato = 'signed' AND NEW.stato = 'signed' THEN
    IF (NEW.generale IS DISTINCT FROM OLD.generale
        OR NEW.patologica IS DISTINCT FROM OLD.patologica
        OR NEW.farmacologica IS DISTINCT FROM OLD.farmacologica
        OR NEW.estetica IS DISTINCT FROM OLD.estetica
        OR NEW.note_libere IS DISTINCT FROM OLD.note_libere) THEN
      RAISE EXCEPTION 'Anamnesi firmata non modificabile: crea una nuova versione';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anamnesi_signed_protect ON public.anamnesi;
CREATE TRIGGER trg_anamnesi_signed_protect
  BEFORE UPDATE ON public.anamnesi
  FOR EACH ROW EXECUTE FUNCTION public.anamnesi_signed_protect();

-- trattamento_pacchetto
CREATE TABLE IF NOT EXISTS public.trattamento_pacchetto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trattamento_id uuid NOT NULL,
  nome text NOT NULL,
  numero_sedute integer NOT NULL CHECK (numero_sedute > 0),
  prezzo_pacchetto numeric NOT NULL CHECK (prezzo_pacchetto >= 0),
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trattamento_pacchetto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pacchetti visibili a operatori attivi" ON public.trattamento_pacchetto
  FOR SELECT TO authenticated USING (is_active_operator(auth.uid()));
CREATE POLICY "Solo medici creano pacchetti" ON public.trattamento_pacchetto
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'medico'::app_role));
CREATE POLICY "Solo medici modificano pacchetti" ON public.trattamento_pacchetto
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'medico'::app_role));
CREATE POLICY "Solo medici eliminano pacchetti" ON public.trattamento_pacchetto
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'medico'::app_role));

CREATE TRIGGER trg_trattamento_pacchetto_updated
  BEFORE UPDATE ON public.trattamento_pacchetto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- piano_trattamento
ALTER TABLE public.piano_trattamento
  ADD COLUMN IF NOT EXISTS sconto numeric NOT NULL DEFAULT 0 CHECK (sconto >= 0),
  ADD COLUMN IF NOT EXISTS prezzo_finale numeric;

-- piano_trattamento_voce
CREATE TABLE IF NOT EXISTS public.piano_trattamento_voce (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piano_id uuid NOT NULL,
  trattamento_id uuid NOT NULL,
  pacchetto_id uuid,
  numero_sedute integer NOT NULL DEFAULT 1 CHECK (numero_sedute > 0),
  prezzo_unitario numeric NOT NULL DEFAULT 0,
  prezzo_riga numeric NOT NULL DEFAULT 0,
  ordine integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.piano_trattamento_voce ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Voci piano visibili a operatori attivi" ON public.piano_trattamento_voce
  FOR SELECT TO authenticated USING (is_active_operator(auth.uid()));
CREATE POLICY "Voci piano insert da operatori attivi" ON public.piano_trattamento_voce
  FOR INSERT TO authenticated WITH CHECK (is_active_operator(auth.uid()));
CREATE POLICY "Voci piano update da operatori attivi" ON public.piano_trattamento_voce
  FOR UPDATE TO authenticated USING (is_active_operator(auth.uid()));
CREATE POLICY "Solo medici eliminano voci piano" ON public.piano_trattamento_voce
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'medico'::app_role));

-- seduta: collegamento voce e trattamento
ALTER TABLE public.seduta
  ADD COLUMN IF NOT EXISTS voce_id uuid,
  ADD COLUMN IF NOT EXISTS trattamento_id uuid;

-- audit pazienti
CREATE OR REPLACE FUNCTION public.audit_pazienti_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
  uid uuid := auth.uid();
BEGIN
  IF NEW.telefono IS DISTINCT FROM OLD.telefono THEN
    changes := changes || jsonb_build_object('telefono', jsonb_build_object('prima', OLD.telefono, 'dopo', NEW.telefono));
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    changes := changes || jsonb_build_object('email', jsonb_build_object('prima', OLD.email, 'dopo', NEW.email));
  END IF;
  IF NEW.codice_fiscale IS DISTINCT FROM OLD.codice_fiscale THEN
    changes := changes || jsonb_build_object('codice_fiscale', jsonb_build_object('prima', OLD.codice_fiscale, 'dopo', NEW.codice_fiscale));
  END IF;
  IF NEW.indirizzo IS DISTINCT FROM OLD.indirizzo THEN
    changes := changes || jsonb_build_object('indirizzo', jsonb_build_object('prima', OLD.indirizzo, 'dopo', NEW.indirizzo));
  END IF;
  IF NEW.citta IS DISTINCT FROM OLD.citta THEN
    changes := changes || jsonb_build_object('citta', jsonb_build_object('prima', OLD.citta, 'dopo', NEW.citta));
  END IF;
  IF NEW.cap IS DISTINCT FROM OLD.cap THEN
    changes := changes || jsonb_build_object('cap', jsonb_build_object('prima', OLD.cap, 'dopo', NEW.cap));
  END IF;
  IF NEW.provincia IS DISTINCT FROM OLD.provincia THEN
    changes := changes || jsonb_build_object('provincia', jsonb_build_object('prima', OLD.provincia, 'dopo', NEW.provincia));
  END IF;
  IF changes <> '{}'::jsonb THEN
    INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, metadata)
    VALUES (uid, 'update', 'paziente', NEW.id, changes);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_pazienti ON public.pazienti;
CREATE TRIGGER trg_audit_pazienti
  AFTER UPDATE ON public.pazienti
  FOR EACH ROW EXECUTE FUNCTION public.audit_pazienti_changes();

-- RPC stato consensi (riricreata con tipo nuovo)
CREATE OR REPLACE FUNCTION public.paziente_consensi_stato(_paziente_id uuid)
RETURNS TABLE(
  consenso_id uuid,
  template_id uuid,
  titolo text,
  versione text,
  categoria public.consenso_categoria,
  firmato_il timestamptz,
  valido_fino_a timestamptz,
  rifiutato boolean,
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
    cf.rifiutato,
    CASE
      WHEN cf.rifiutato THEN 'rifiutato'
      WHEN cf.revocato_il IS NOT NULL THEN 'revoked'
      WHEN cf.categoria_snapshot = 'trattamento_singolo' AND EXISTS (
        SELECT 1 FROM public.seduta s
        WHERE s.id = cf.seduta_id AND s.completata = true
      ) THEN 'expired'
      WHEN cf.valido_fino_a IS NOT NULL AND cf.valido_fino_a <= now() THEN 'expired'
      WHEN ct.id IS NULL OR ct.attivo = false THEN 'obsolete'
      WHEN ct.versione <> cf.versione_snapshot THEN 'obsolete'
      WHEN cf.valido_fino_a IS NOT NULL AND cf.valido_fino_a <= now() + interval '30 days' THEN 'expiring'
      ELSE 'valid'
    END AS stato
  FROM public.consenso_firmato cf
  LEFT JOIN public.consenso_template ct ON ct.id = cf.template_id
  WHERE cf.paziente_id = _paziente_id
  ORDER BY cf.firmato_il DESC;
$$;

CREATE OR REPLACE FUNCTION public.has_consenso_valido(_paziente_id uuid, _template_id uuid)
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
      AND cf.rifiutato = false
      AND cf.versione_snapshot = ct.versione
      AND ct.attivo = true
      AND (cf.valido_fino_a IS NULL OR cf.valido_fino_a > now())
  );
$$;

-- Bucket anamnesi PDF
INSERT INTO storage.buckets (id, name, public)
VALUES ('anamnesi-pdf', 'anamnesi-pdf', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anamnesi PDF visibili operatori attivi"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'anamnesi-pdf' AND is_active_operator(auth.uid()));

CREATE POLICY "Anamnesi PDF caricabili da operatori attivi"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anamnesi-pdf' AND is_active_operator(auth.uid()));
