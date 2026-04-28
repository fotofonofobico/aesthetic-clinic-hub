-- 1. Voci piano: prodotti per singola seduta (opzionale)
ALTER TABLE public.piano_trattamento_voce
  ADD COLUMN IF NOT EXISTS prodotti_per_seduta jsonb;

-- 2. Template consenso: tipo durata e durata in sedute
ALTER TABLE public.consenso_template
  ADD COLUMN IF NOT EXISTS durata_tipo text NOT NULL DEFAULT 'mesi',
  ADD COLUMN IF NOT EXISTS durata_sedute integer;

ALTER TABLE public.consenso_template
  DROP CONSTRAINT IF EXISTS consenso_template_durata_tipo_check;
ALTER TABLE public.consenso_template
  ADD CONSTRAINT consenso_template_durata_tipo_check
  CHECK (durata_tipo IN ('mesi','sedute'));

-- 3. Consenso firmato: snapshot durata + contatore sedute
ALTER TABLE public.consenso_firmato
  ADD COLUMN IF NOT EXISTS durata_tipo_snapshot text NOT NULL DEFAULT 'mesi',
  ADD COLUMN IF NOT EXISTS durata_sedute_snapshot integer,
  ADD COLUMN IF NOT EXISTS sedute_max_snapshot integer,
  ADD COLUMN IF NOT EXISTS sedute_consumate integer NOT NULL DEFAULT 0;

ALTER TABLE public.consenso_firmato
  DROP CONSTRAINT IF EXISTS consenso_firmato_durata_tipo_check;
ALTER TABLE public.consenso_firmato
  ADD CONSTRAINT consenso_firmato_durata_tipo_check
  CHECK (durata_tipo_snapshot IN ('mesi','sedute'));

-- 4. Seduta: data programmata opzionale (data da definire)
ALTER TABLE public.seduta
  ALTER COLUMN data_seduta DROP NOT NULL,
  ALTER COLUMN data_seduta DROP DEFAULT;

-- 5. RPC paziente_consensi_stato: gestisce anche durata 'sedute'
CREATE OR REPLACE FUNCTION public.paziente_consensi_stato(_paziente_id uuid)
 RETURNS TABLE(consenso_id uuid, template_id uuid, titolo text, versione text, categoria consenso_categoria, firmato_il timestamp with time zone, valido_fino_a timestamp with time zone, rifiutato boolean, stato text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- Durata a sedute: scaduto se contatore raggiunge il max
      WHEN cf.durata_tipo_snapshot = 'sedute'
           AND cf.sedute_max_snapshot IS NOT NULL
           AND cf.sedute_consumate >= cf.sedute_max_snapshot THEN 'expired'
      -- Durata a sedute: in scadenza se rimane <= 1 seduta
      WHEN cf.durata_tipo_snapshot = 'sedute'
           AND cf.sedute_max_snapshot IS NOT NULL
           AND (cf.sedute_max_snapshot - cf.sedute_consumate) <= 1 THEN 'expiring'
      -- Durata a mesi: scaduto per data
      WHEN cf.durata_tipo_snapshot = 'mesi'
           AND cf.valido_fino_a IS NOT NULL
           AND cf.valido_fino_a <= now() THEN 'expired'
      WHEN ct.id IS NULL OR ct.attivo = false THEN 'obsolete'
      WHEN ct.versione <> cf.versione_snapshot THEN 'obsolete'
      WHEN cf.durata_tipo_snapshot = 'mesi'
           AND cf.valido_fino_a IS NOT NULL
           AND cf.valido_fino_a <= now() + interval '30 days' THEN 'expiring'
      ELSE 'valid'
    END AS stato
  FROM public.consenso_firmato cf
  LEFT JOIN public.consenso_template ct ON ct.id = cf.template_id
  WHERE cf.paziente_id = _paziente_id
  ORDER BY cf.firmato_il DESC;
$function$;

-- 6. Trigger: quando una seduta diventa completata, consuma 1 sull'eventuale
-- consenso ciclo a sedute valido per quel paziente/trattamento.
CREATE OR REPLACE FUNCTION public.consenso_consuma_seduta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  tpl_id uuid;
BEGIN
  IF NEW.completata = true AND COALESCE(OLD.completata, false) = false
     AND NEW.trattamento_id IS NOT NULL THEN
    SELECT consenso_template_id INTO tpl_id
      FROM public.trattamenti WHERE id = NEW.trattamento_id;
    IF tpl_id IS NOT NULL THEN
      UPDATE public.consenso_firmato
         SET sedute_consumate = sedute_consumate + 1
       WHERE id = (
         SELECT cf.id FROM public.consenso_firmato cf
          WHERE cf.paziente_id = NEW.paziente_id
            AND cf.template_id = tpl_id
            AND cf.durata_tipo_snapshot = 'sedute'
            AND cf.rifiutato = false
            AND cf.revocato_il IS NULL
            AND cf.sedute_max_snapshot IS NOT NULL
            AND cf.sedute_consumate < cf.sedute_max_snapshot
          ORDER BY cf.firmato_il DESC
          LIMIT 1
       );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_consenso_consuma_seduta ON public.seduta;
CREATE TRIGGER trg_consenso_consuma_seduta
  AFTER UPDATE ON public.seduta
  FOR EACH ROW
  EXECUTE FUNCTION public.consenso_consuma_seduta();