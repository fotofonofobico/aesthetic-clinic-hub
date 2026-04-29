-- Tabella sessioni firma per modalità tablet
CREATE TYPE public.firma_sessione_stato AS ENUM ('waiting', 'pending', 'signed', 'refused', 'expired', 'cancelled');
CREATE TYPE public.firma_sessione_tipo AS ENUM ('consenso', 'anamnesi');

CREATE TABLE public.firma_sessione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.firma_sessione_tipo NOT NULL,
  -- target_id: id template consenso (per nuova firma) o id anamnesi
  target_id uuid NOT NULL,
  paziente_id uuid NOT NULL,
  -- payload snapshot mostrato sul tablet (titolo, testo, clausole acconsento)
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  stato public.firma_sessione_stato NOT NULL DEFAULT 'pending',
  -- risposte del paziente
  firma_paziente_base64 text,
  acconsensi jsonb, -- { "clausola_id": true/false, ... } o { "accetto": true }
  rifiuto_motivo text,
  -- metadata
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  signed_at timestamptz,
  -- una volta consumata (firma trasferita nelle tabelle finali)
  consumed_at timestamptz,
  consumed_into_id uuid -- id della consenso_firmato/anamnesi finale
);

CREATE INDEX idx_firma_sessione_created_by_stato ON public.firma_sessione(created_by, stato) WHERE consumed_at IS NULL;
CREATE INDEX idx_firma_sessione_paziente ON public.firma_sessione(paziente_id);

-- Trigger updated_at
CREATE TRIGGER trg_firma_sessione_updated_at
  BEFORE UPDATE ON public.firma_sessione
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.firma_sessione ENABLE ROW LEVEL SECURITY;

-- Operatori attivi vedono tutte le sessioni (per supportare iPad in modalità firma con qualsiasi medico loggato)
CREATE POLICY "Sessioni firma visibili a operatori attivi"
  ON public.firma_sessione FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Sessioni firma creabili da operatori attivi"
  ON public.firma_sessione FOR INSERT TO authenticated
  WITH CHECK (public.is_active_operator(auth.uid()) AND auth.uid() = created_by);

-- Update consentito a operatori attivi (sia il Mac per cancel, sia l'iPad per firmare)
CREATE POLICY "Sessioni firma aggiornabili da operatori attivi"
  ON public.firma_sessione FOR UPDATE TO authenticated
  USING (public.is_active_operator(auth.uid()));

-- Solo medici cancellano definitivamente
CREATE POLICY "Solo medici eliminano sessioni firma"
  ON public.firma_sessione FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'medico'::app_role));

-- Realtime
ALTER TABLE public.firma_sessione REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.firma_sessione;

-- Funzione: marca sessioni scadute (chiamabile via cron in futuro o on-demand)
CREATE OR REPLACE FUNCTION public.firma_sessione_marca_scadute()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.firma_sessione
     SET stato = 'expired'
   WHERE stato IN ('waiting', 'pending')
     AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;