-- ============================================================
-- 1. Estensione tabella seduta
-- ============================================================
ALTER TABLE public.seduta
  ALTER COLUMN piano_id DROP NOT NULL;

ALTER TABLE public.seduta
  ADD COLUMN IF NOT EXISTS data_esecuzione_effettiva timestamptz,
  ADD COLUMN IF NOT EXISTS data_registrazione timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS firmata_il timestamptz,
  ADD COLUMN IF NOT EXISTS firmata_da uuid,
  ADD COLUMN IF NOT EXISTS nota_diario_id uuid;

CREATE INDEX IF NOT EXISTS idx_seduta_paziente_data
  ON public.seduta(paziente_id, COALESCE(data_esecuzione_effettiva, data_seduta) DESC);

CREATE INDEX IF NOT EXISTS idx_seduta_completata
  ON public.seduta(paziente_id, completata);

-- ============================================================
-- 2. Audit modifiche seduta
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seduta_modifica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seduta_id uuid NOT NULL REFERENCES public.seduta(id) ON DELETE CASCADE,
  modificata_da uuid NOT NULL,
  modificata_il timestamptz NOT NULL DEFAULT now(),
  campo text NOT NULL,
  valore_precedente jsonb,
  valore_nuovo jsonb,
  motivo text,
  oltre_48h boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_seduta_modifica_seduta
  ON public.seduta_modifica(seduta_id, modificata_il DESC);

ALTER TABLE public.seduta_modifica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Modifiche seduta visibili a operatori attivi"
  ON public.seduta_modifica FOR SELECT TO authenticated
  USING (is_active_operator(auth.uid()));

CREATE POLICY "Modifiche seduta inseribili da operatori attivi"
  ON public.seduta_modifica FOR INSERT TO authenticated
  WITH CHECK (is_active_operator(auth.uid()) AND auth.uid() = modificata_da);

-- niente UPDATE / DELETE: audit immutabile

-- ============================================================
-- 3. Estensione paziente_nota per integrazione sedute
-- ============================================================
ALTER TABLE public.paziente_nota
  ADD COLUMN IF NOT EXISTS seduta_id uuid REFERENCES public.seduta(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_generata boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS firmata_il timestamptz,
  ADD COLUMN IF NOT EXISTS firmata_da uuid;

CREATE INDEX IF NOT EXISTS idx_paziente_nota_seduta
  ON public.paziente_nota(seduta_id);

-- ============================================================
-- 4. Audit modifiche nota (stessa logica della seduta)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.paziente_nota_modifica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id uuid NOT NULL REFERENCES public.paziente_nota(id) ON DELETE CASCADE,
  modificata_da uuid NOT NULL,
  modificata_il timestamptz NOT NULL DEFAULT now(),
  campo text NOT NULL,
  valore_precedente jsonb,
  valore_nuovo jsonb,
  motivo text,
  oltre_48h boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_paziente_nota_modifica_nota
  ON public.paziente_nota_modifica(nota_id, modificata_il DESC);

ALTER TABLE public.paziente_nota_modifica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Modifiche nota visibili a operatori attivi"
  ON public.paziente_nota_modifica FOR SELECT TO authenticated
  USING (is_active_operator(auth.uid()));

CREATE POLICY "Modifiche nota inseribili da operatori attivi"
  ON public.paziente_nota_modifica FOR INSERT TO authenticated
  WITH CHECK (is_active_operator(auth.uid()) AND auth.uid() = modificata_da);

-- ============================================================
-- 5. Trigger: sync diario quando seduta viene completata
-- ============================================================
CREATE OR REPLACE FUNCTION public.seduta_sync_diario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  riassunto text;
  trattamento_nome text;
  operatore_nome text;
  zone_txt text;
  prodotti_txt text;
  data_eff timestamptz;
  voce_zone jsonb;
  voce_prodotti jsonb;
  zone_arr text[];
  prodotti_arr text[];
  nota_existing_id uuid;
  new_nota_id uuid;
BEGIN
  -- Caso 1: seduta torna a NON completata -> rimuovi nota auto
  IF (TG_OP = 'UPDATE' AND OLD.completata = true AND NEW.completata = false) THEN
    IF OLD.nota_diario_id IS NOT NULL THEN
      DELETE FROM public.paziente_nota
        WHERE id = OLD.nota_diario_id AND auto_generata = true;
    END IF;
    NEW.nota_diario_id := NULL;
    NEW.firmata_il := NULL;
    NEW.firmata_da := NULL;
    RETURN NEW;
  END IF;

  -- Caso 2: seduta viene completata o aggiornata mentre completata -> crea/aggiorna nota
  IF NEW.completata = true THEN
    -- Imposta firma se prima volta
    IF NEW.firmata_il IS NULL THEN
      NEW.firmata_il := now();
      NEW.firmata_da := COALESCE(NEW.firmata_da, NEW.operatore_id, auth.uid());
    END IF;

    -- Recupera nome trattamento
    SELECT nome INTO trattamento_nome
      FROM public.trattamenti WHERE id = NEW.trattamento_id;

    -- Recupera nome operatore
    SELECT nome || ' ' || cognome INTO operatore_nome
      FROM public.profiles WHERE user_id = NEW.operatore_id;

    -- Recupera zone e prodotti dalla voce piano se esiste
    voce_zone := NULL;
    voce_prodotti := NULL;
    IF NEW.voce_id IS NOT NULL THEN
      SELECT zone, prodotti_previsti INTO voce_zone, voce_prodotti
        FROM public.piano_trattamento_voce WHERE id = NEW.voce_id;
    END IF;

    -- Estrai zone come testo
    SELECT array_agg(value::text)
      INTO zone_arr
      FROM jsonb_array_elements_text(COALESCE(voce_zone, '[]'::jsonb)) AS value;

    -- Estrai prodotti come testo "nome xN"
    SELECT array_agg(
      (p->>'nome') ||
      CASE WHEN (p->>'quantita') IS NOT NULL AND (p->>'quantita') <> '0'
           THEN ' x' || (p->>'quantita')
           ELSE '' END
    )
    INTO prodotti_arr
    FROM jsonb_array_elements(COALESCE(NEW.prodotti_previsti, '[]'::jsonb)) AS p;

    zone_txt := COALESCE(array_to_string(zone_arr, ', '), '');
    prodotti_txt := COALESCE(array_to_string(prodotti_arr, ', '), '');
    data_eff := COALESCE(NEW.data_esecuzione_effettiva, NEW.data_seduta);

    -- Costruisci riassunto
    riassunto := COALESCE(trattamento_nome, 'Trattamento') ||
      ' (seduta #' || NEW.numero_seduta || ')';
    IF operatore_nome IS NOT NULL AND trim(operatore_nome) <> '' THEN
      riassunto := riassunto || E'\nOperatore: ' || operatore_nome;
    END IF;
    IF zone_txt <> '' THEN
      riassunto := riassunto || E'\nZone: ' || zone_txt;
    END IF;
    IF prodotti_txt <> '' THEN
      riassunto := riassunto || E'\nProdotti: ' || prodotti_txt;
    END IF;
    IF NEW.durata_minuti IS NOT NULL THEN
      riassunto := riassunto || E'\nDurata: ' || NEW.durata_minuti || ' min';
    END IF;
    IF NEW.note_cliniche IS NOT NULL AND trim(NEW.note_cliniche) <> '' THEN
      riassunto := riassunto || E'\nNote cliniche: ' || NEW.note_cliniche;
    END IF;
    IF date_trunc('minute', NEW.data_registrazione) <> date_trunc('minute', data_eff) THEN
      riassunto := riassunto || E'\n(registrata il ' ||
        to_char(NEW.data_registrazione, 'DD/MM/YYYY HH24:MI') || ')';
    END IF;

    -- Esiste già una nota collegata?
    nota_existing_id := NEW.nota_diario_id;

    IF nota_existing_id IS NOT NULL THEN
      UPDATE public.paziente_nota
         SET testo = riassunto,
             data_evento = data_eff,
             updated_at = now()
       WHERE id = nota_existing_id;
    ELSE
      INSERT INTO public.paziente_nota (
        paziente_id, tipo, testo, data_evento,
        created_by, seduta_id, auto_generata,
        firmata_il, firmata_da
      ) VALUES (
        NEW.paziente_id, 'clinica', riassunto, data_eff,
        COALESCE(NEW.firmata_da, NEW.operatore_id, auth.uid()),
        NEW.id, true,
        NEW.firmata_il, NEW.firmata_da
      ) RETURNING id INTO new_nota_id;
      NEW.nota_diario_id := new_nota_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seduta_sync_diario ON public.seduta;
CREATE TRIGGER trg_seduta_sync_diario
  BEFORE INSERT OR UPDATE ON public.seduta
  FOR EACH ROW
  EXECUTE FUNCTION public.seduta_sync_diario();
