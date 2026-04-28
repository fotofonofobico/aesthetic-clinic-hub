-- Sconto piano
ALTER TABLE public.piano_trattamento
  ADD COLUMN IF NOT EXISTS sconto_tipo text NOT NULL DEFAULT 'nessuno',
  ADD COLUMN IF NOT EXISTS sconto_valore numeric NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'piano_trattamento_sconto_tipo_check'
  ) THEN
    ALTER TABLE public.piano_trattamento
      ADD CONSTRAINT piano_trattamento_sconto_tipo_check
      CHECK (sconto_tipo IN ('nessuno','euro','percento'));
  END IF;
END $$;

-- Zone trattate sulla riga del piano
ALTER TABLE public.piano_trattamento_voce
  ADD COLUMN IF NOT EXISTS zone jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Trigger auto-stato piano
CREATE OR REPLACE FUNCTION public.piano_auto_stato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid := COALESCE(NEW.piano_id, OLD.piano_id);
  tot int;
  done int;
  cur_stato piano_stato;
BEGIN
  IF pid IS NULL THEN RETURN NEW; END IF;
  SELECT stato INTO cur_stato FROM piano_trattamento WHERE id = pid;
  IF cur_stato IS NULL OR cur_stato IN ('sospeso','annullato') THEN RETURN NEW; END IF;
  SELECT count(*), count(*) FILTER (WHERE completata) INTO tot, done
    FROM seduta WHERE piano_id = pid;
  IF tot > 0 AND done = tot THEN
    UPDATE piano_trattamento SET stato = 'completato'
      WHERE id = pid AND stato <> 'completato';
  ELSIF cur_stato = 'completato' AND done < tot THEN
    UPDATE piano_trattamento SET stato = 'attivo' WHERE id = pid;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seduta_piano_auto_stato ON public.seduta;
CREATE TRIGGER trg_seduta_piano_auto_stato
AFTER INSERT OR UPDATE OF completata OR DELETE ON public.seduta
FOR EACH ROW EXECUTE FUNCTION public.piano_auto_stato();