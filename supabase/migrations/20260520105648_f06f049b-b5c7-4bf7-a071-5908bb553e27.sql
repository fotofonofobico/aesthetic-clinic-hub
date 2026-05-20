-- 1. Aggiunta colonna altezza_cm
ALTER TABLE public.paziente_misurazione
  ADD COLUMN IF NOT EXISTS altezza_cm integer;

-- 2. Funzione di sync: aggiorna pazienti.peso_kg/altezza_cm con l'ultimo valore non-null
CREATE OR REPLACE FUNCTION public.paziente_misurazione_sync_anagrafica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
  ultimo_peso numeric;
  ultima_altezza integer;
BEGIN
  pid := COALESCE(NEW.paziente_id, OLD.paziente_id);
  IF pid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT peso_kg INTO ultimo_peso
    FROM public.paziente_misurazione
   WHERE paziente_id = pid AND peso_kg IS NOT NULL
   ORDER BY data_rilevazione DESC, created_at DESC
   LIMIT 1;

  SELECT altezza_cm INTO ultima_altezza
    FROM public.paziente_misurazione
   WHERE paziente_id = pid AND altezza_cm IS NOT NULL
   ORDER BY data_rilevazione DESC, created_at DESC
   LIMIT 1;

  -- Conservativo: aggiorna solo se abbiamo un valore (non sovrascrive con null)
  IF ultimo_peso IS NOT NULL THEN
    UPDATE public.pazienti SET peso_kg = ultimo_peso
     WHERE id = pid AND peso_kg IS DISTINCT FROM ultimo_peso;
  END IF;
  IF ultima_altezza IS NOT NULL THEN
    UPDATE public.pazienti SET altezza_cm = ultima_altezza
     WHERE id = pid AND altezza_cm IS DISTINCT FROM ultima_altezza;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Trigger
DROP TRIGGER IF EXISTS trg_paziente_misurazione_sync ON public.paziente_misurazione;
CREATE TRIGGER trg_paziente_misurazione_sync
AFTER INSERT OR UPDATE OR DELETE ON public.paziente_misurazione
FOR EACH ROW EXECUTE FUNCTION public.paziente_misurazione_sync_anagrafica();

-- 4. Backfill conservativo
-- 4a. Pazienti con peso/altezza ma senza misurazioni -> crea misurazione iniziale
INSERT INTO public.paziente_misurazione (paziente_id, data_rilevazione, peso_kg, altezza_cm, created_by, note)
SELECT p.id, CURRENT_DATE, p.peso_kg, p.altezza_cm, p.created_by, 'Misurazione iniziale (migrazione)'
  FROM public.pazienti p
 WHERE (p.peso_kg IS NOT NULL OR p.altezza_cm IS NOT NULL)
   AND NOT EXISTS (
     SELECT 1 FROM public.paziente_misurazione m WHERE m.paziente_id = p.id
   );

-- 4b. Pazienti con misurazioni ma altezza_cm assente nelle rilevazioni -> copia da anagrafica nella più recente
UPDATE public.paziente_misurazione m
   SET altezza_cm = p.altezza_cm
  FROM public.pazienti p
 WHERE m.paziente_id = p.id
   AND p.altezza_cm IS NOT NULL
   AND m.id = (
     SELECT id FROM public.paziente_misurazione
      WHERE paziente_id = p.id
      ORDER BY data_rilevazione DESC, created_at DESC
      LIMIT 1
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.paziente_misurazione m2
      WHERE m2.paziente_id = p.id AND m2.altezza_cm IS NOT NULL
   );