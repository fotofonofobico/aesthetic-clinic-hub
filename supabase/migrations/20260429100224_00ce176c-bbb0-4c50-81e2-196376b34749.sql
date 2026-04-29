
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE foto_momento AS ENUM ('prima', 'dopo');
CREATE TYPE piano_foto_stato_enum AS ENUM ('completo', 'baseline_mancante', 'non_eseguibile');

-- =========================================================
-- TABELLA foto_clinica
-- =========================================================
CREATE TABLE public.foto_clinica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paziente_id uuid NOT NULL,
  piano_id uuid NOT NULL,
  seduta_id uuid NULL,
  momento foto_momento NOT NULL,
  livello text GENERATED ALWAYS AS (CASE WHEN seduta_id IS NULL THEN 'piano' ELSE 'seduta' END) STORED,
  zona text NULL,
  storage_path text NOT NULL,
  data_scatto date NOT NULL DEFAULT CURRENT_DATE,
  data_caricamento timestamptz NOT NULL DEFAULT now(),
  note text NULL,
  created_by uuid NULL
);

CREATE INDEX idx_foto_clinica_piano ON public.foto_clinica(piano_id);
CREATE INDEX idx_foto_clinica_seduta ON public.foto_clinica(seduta_id);
CREATE INDEX idx_foto_clinica_paziente ON public.foto_clinica(paziente_id);

ALTER TABLE public.foto_clinica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Foto visibili a operatori attivi"
  ON public.foto_clinica FOR SELECT TO authenticated
  USING (is_active_operator(auth.uid()));

CREATE POLICY "Foto creabili da operatori attivi"
  ON public.foto_clinica FOR INSERT TO authenticated
  WITH CHECK (is_active_operator(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Foto aggiornabili da autore o medico"
  ON public.foto_clinica FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'medico'::app_role));

CREATE POLICY "Solo medici eliminano foto"
  ON public.foto_clinica FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'medico'::app_role));

-- =========================================================
-- TABELLA piano_foto_stato
-- =========================================================
CREATE TABLE public.piano_foto_stato (
  piano_id uuid PRIMARY KEY,
  stato piano_foto_stato_enum NOT NULL DEFAULT 'baseline_mancante',
  motivazione text NULL,
  incoerenza_data boolean NOT NULL DEFAULT false,
  cambiato_da uuid NULL,
  cambiato_il timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.piano_foto_stato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stato foto visibile a operatori attivi"
  ON public.piano_foto_stato FOR SELECT TO authenticated
  USING (is_active_operator(auth.uid()));

CREATE POLICY "Stato foto inseribile da operatori attivi"
  ON public.piano_foto_stato FOR INSERT TO authenticated
  WITH CHECK (is_active_operator(auth.uid()));

CREATE POLICY "Stato foto aggiornabile da operatori attivi"
  ON public.piano_foto_stato FOR UPDATE TO authenticated
  USING (is_active_operator(auth.uid()));

-- =========================================================
-- TABELLA piano_foto_stato_log
-- =========================================================
CREATE TABLE public.piano_foto_stato_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piano_id uuid NOT NULL,
  stato_precedente piano_foto_stato_enum NULL,
  stato_nuovo piano_foto_stato_enum NOT NULL,
  motivazione text NULL,
  cambiato_da uuid NULL,
  cambiato_il timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_piano_foto_stato_log_piano ON public.piano_foto_stato_log(piano_id);

ALTER TABLE public.piano_foto_stato_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Log stato foto visibile a operatori attivi"
  ON public.piano_foto_stato_log FOR SELECT TO authenticated
  USING (is_active_operator(auth.uid()));

CREATE POLICY "Log stato foto inseribile da operatori attivi"
  ON public.piano_foto_stato_log FOR INSERT TO authenticated
  WITH CHECK (is_active_operator(auth.uid()));

-- =========================================================
-- TRIGGER: log automatico cambi stato piano_foto_stato
-- =========================================================
CREATE OR REPLACE FUNCTION public.piano_foto_stato_log_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.piano_foto_stato_log(piano_id, stato_precedente, stato_nuovo, motivazione, cambiato_da)
    VALUES (NEW.piano_id, NULL, NEW.stato, NEW.motivazione, NEW.cambiato_da);
  ELSIF NEW.stato IS DISTINCT FROM OLD.stato OR NEW.motivazione IS DISTINCT FROM OLD.motivazione THEN
    INSERT INTO public.piano_foto_stato_log(piano_id, stato_precedente, stato_nuovo, motivazione, cambiato_da)
    VALUES (NEW.piano_id, OLD.stato, NEW.stato, NEW.motivazione, NEW.cambiato_da);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_piano_foto_stato_log
AFTER INSERT OR UPDATE ON public.piano_foto_stato
FOR EACH ROW EXECUTE FUNCTION public.piano_foto_stato_log_trg();

-- =========================================================
-- TRIGGER: init stato alla creazione di un piano
-- =========================================================
CREATE OR REPLACE FUNCTION public.piano_foto_stato_init()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.piano_foto_stato(piano_id, stato, cambiato_da)
  VALUES (NEW.id, 'baseline_mancante', NEW.created_by)
  ON CONFLICT (piano_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_piano_foto_stato_init
AFTER INSERT ON public.piano_trattamento
FOR EACH ROW EXECUTE FUNCTION public.piano_foto_stato_init();

-- Backfill per piani esistenti
INSERT INTO public.piano_foto_stato(piano_id, stato, cambiato_da)
SELECT id, 'baseline_mancante', created_by
FROM public.piano_trattamento
ON CONFLICT (piano_id) DO NOTHING;

-- =========================================================
-- TRIGGER: ricalcolo stato all'inserimento foto baseline
-- =========================================================
CREATE OR REPLACE FUNCTION public.foto_clinica_aggiorna_stato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prima_seduta date;
  has_baseline_valida boolean;
  has_baseline_incoerente boolean;
  cur_stato piano_foto_stato_enum;
BEGIN
  -- Solo foto livello piano + momento prima impattano lo stato
  IF NEW.seduta_id IS NOT NULL OR NEW.momento <> 'prima' THEN
    RETURN NEW;
  END IF;

  SELECT stato INTO cur_stato FROM public.piano_foto_stato WHERE piano_id = NEW.piano_id;
  -- Non sovrascrivere mai 'non_eseguibile' (decisione medica)
  IF cur_stato = 'non_eseguibile' THEN
    RETURN NEW;
  END IF;

  SELECT MIN(data_seduta)::date INTO prima_seduta
    FROM public.seduta
   WHERE piano_id = NEW.piano_id AND data_seduta IS NOT NULL;

  -- Se non c'è ancora una prima seduta programmata, qualsiasi foto prima è valida
  IF prima_seduta IS NULL THEN
    has_baseline_valida := true;
    has_baseline_incoerente := false;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.foto_clinica
       WHERE piano_id = NEW.piano_id
         AND seduta_id IS NULL
         AND momento = 'prima'
         AND data_scatto <= prima_seduta
    ) INTO has_baseline_valida;

    SELECT EXISTS(
      SELECT 1 FROM public.foto_clinica
       WHERE piano_id = NEW.piano_id
         AND seduta_id IS NULL
         AND momento = 'prima'
         AND data_scatto > prima_seduta
    ) INTO has_baseline_incoerente;
  END IF;

  IF has_baseline_valida THEN
    UPDATE public.piano_foto_stato
       SET stato = 'completo',
           incoerenza_data = false,
           motivazione = NULL,
           cambiato_da = auth.uid(),
           cambiato_il = now()
     WHERE piano_id = NEW.piano_id
       AND stato <> 'completo';
  ELSIF has_baseline_incoerente THEN
    UPDATE public.piano_foto_stato
       SET incoerenza_data = true,
           cambiato_da = auth.uid(),
           cambiato_il = now()
     WHERE piano_id = NEW.piano_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_foto_clinica_aggiorna_stato
AFTER INSERT ON public.foto_clinica
FOR EACH ROW EXECUTE FUNCTION public.foto_clinica_aggiorna_stato();

-- =========================================================
-- RPC: marca piano come non_eseguibile (solo medico)
-- =========================================================
CREATE OR REPLACE FUNCTION public.piano_foto_marca_non_eseguibile(_piano_id uuid, _motivazione text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'medico'::app_role) THEN
    RAISE EXCEPTION 'Solo i medici possono marcare un piano come non eseguibile';
  END IF;
  IF _motivazione IS NULL OR length(trim(_motivazione)) < 5 THEN
    RAISE EXCEPTION 'Motivazione obbligatoria (almeno 5 caratteri)';
  END IF;

  INSERT INTO public.piano_foto_stato(piano_id, stato, motivazione, cambiato_da, cambiato_il)
  VALUES (_piano_id, 'non_eseguibile', _motivazione, auth.uid(), now())
  ON CONFLICT (piano_id) DO UPDATE
    SET stato = 'non_eseguibile',
        motivazione = EXCLUDED.motivazione,
        cambiato_da = auth.uid(),
        cambiato_il = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- =========================================================
-- RPC: riapri piano (annulla non_eseguibile, solo medico)
-- =========================================================
CREATE OR REPLACE FUNCTION public.piano_foto_riapri(_piano_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'medico'::app_role) THEN
    RAISE EXCEPTION 'Solo i medici possono riaprire un piano';
  END IF;

  UPDATE public.piano_foto_stato
     SET stato = 'baseline_mancante',
         motivazione = NULL,
         cambiato_da = auth.uid(),
         cambiato_il = now()
   WHERE piano_id = _piano_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- =========================================================
-- STORAGE BUCKET privato + policy
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('foto-cliniche', 'foto-cliniche', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Foto cliniche leggibili da operatori attivi"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'foto-cliniche' AND is_active_operator(auth.uid()));

CREATE POLICY "Foto cliniche caricabili da operatori attivi"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'foto-cliniche' AND is_active_operator(auth.uid()));

CREATE POLICY "Foto cliniche aggiornabili da operatori attivi"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'foto-cliniche' AND is_active_operator(auth.uid()));

CREATE POLICY "Foto cliniche eliminabili dai medici"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'foto-cliniche' AND has_role(auth.uid(), 'medico'::app_role));
