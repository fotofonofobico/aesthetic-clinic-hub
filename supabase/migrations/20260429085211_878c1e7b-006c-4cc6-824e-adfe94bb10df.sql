-- ============================================================
-- MODULO MAGAZZINO
-- ============================================================

-- Estensione necessaria per gen_random_uuid (di solito già attiva)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. ANAGRAFICA MARCHE
-- ============================================================
CREATE TABLE public.prodotto_marca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  attiva boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE UNIQUE INDEX prodotto_marca_nome_unique ON public.prodotto_marca (lower(nome));

ALTER TABLE public.prodotto_marca ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Marche visibili a operatori attivi"
  ON public.prodotto_marca FOR SELECT TO authenticated
  USING (is_active_operator(auth.uid()));
CREATE POLICY "Marche creabili da operatori attivi"
  ON public.prodotto_marca FOR INSERT TO authenticated
  WITH CHECK (is_active_operator(auth.uid()));
CREATE POLICY "Marche modificabili da operatori attivi"
  ON public.prodotto_marca FOR UPDATE TO authenticated
  USING (is_active_operator(auth.uid()));
CREATE POLICY "Solo medici eliminano marche"
  ON public.prodotto_marca FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'medico'::app_role));

-- ============================================================
-- 2. ANAGRAFICA FORNITORI
-- ============================================================
CREATE TABLE public.prodotto_fornitore (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  contatti jsonb NOT NULL DEFAULT '{}'::jsonb,
  attivo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE UNIQUE INDEX prodotto_fornitore_nome_unique ON public.prodotto_fornitore (lower(nome));

ALTER TABLE public.prodotto_fornitore ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fornitori visibili a operatori attivi"
  ON public.prodotto_fornitore FOR SELECT TO authenticated
  USING (is_active_operator(auth.uid()));
CREATE POLICY "Fornitori creabili da operatori attivi"
  ON public.prodotto_fornitore FOR INSERT TO authenticated
  WITH CHECK (is_active_operator(auth.uid()));
CREATE POLICY "Fornitori modificabili da operatori attivi"
  ON public.prodotto_fornitore FOR UPDATE TO authenticated
  USING (is_active_operator(auth.uid()));
CREATE POLICY "Solo medici eliminano fornitori"
  ON public.prodotto_fornitore FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'medico'::app_role));

CREATE TRIGGER trg_prodotto_fornitore_updated
  BEFORE UPDATE ON public.prodotto_fornitore
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. PRODOTTI
-- ============================================================
CREATE TABLE public.prodotto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipologia text,
  marca_id uuid REFERENCES public.prodotto_marca(id) ON DELETE SET NULL,
  fornitore_id uuid REFERENCES public.prodotto_fornitore(id) ON DELETE SET NULL,
  unita_misura text NOT NULL DEFAULT 'pz',
  costo_unitario_default numeric(12,2),
  soglia_minima numeric(12,2) NOT NULL DEFAULT 0,
  modalita_tracking text NOT NULL DEFAULT 'solo_uso'
    CHECK (modalita_tracking IN ('tracciato','solo_uso','standby')),
  attivo boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE UNIQUE INDEX prodotto_nome_marca_unique
  ON public.prodotto (lower(nome), COALESCE(marca_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX prodotto_modalita_idx ON public.prodotto (modalita_tracking) WHERE attivo = true;

ALTER TABLE public.prodotto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prodotti visibili a operatori attivi"
  ON public.prodotto FOR SELECT TO authenticated
  USING (is_active_operator(auth.uid()));
CREATE POLICY "Prodotti creabili da operatori attivi"
  ON public.prodotto FOR INSERT TO authenticated
  WITH CHECK (is_active_operator(auth.uid()));
CREATE POLICY "Prodotti modificabili da operatori attivi"
  ON public.prodotto FOR UPDATE TO authenticated
  USING (is_active_operator(auth.uid()));
CREATE POLICY "Solo medici eliminano prodotti"
  ON public.prodotto FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'medico'::app_role));

CREATE TRIGGER trg_prodotto_updated
  BEFORE UPDATE ON public.prodotto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. LOTTI
-- ============================================================
CREATE TABLE public.prodotto_lotto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prodotto_id uuid NOT NULL REFERENCES public.prodotto(id) ON DELETE CASCADE,
  numero_lotto text NOT NULL,
  data_scadenza date,
  quantita_iniziale numeric(12,2) NOT NULL DEFAULT 0,
  quantita_disponibile numeric(12,2) NOT NULL DEFAULT 0,
  costo_unitario numeric(12,2),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE UNIQUE INDEX prodotto_lotto_unique ON public.prodotto_lotto (prodotto_id, lower(numero_lotto));
CREATE INDEX prodotto_lotto_scadenza_idx ON public.prodotto_lotto (data_scadenza) WHERE quantita_disponibile > 0;
CREATE INDEX prodotto_lotto_prodotto_idx ON public.prodotto_lotto (prodotto_id);

ALTER TABLE public.prodotto_lotto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lotti visibili a operatori attivi"
  ON public.prodotto_lotto FOR SELECT TO authenticated
  USING (is_active_operator(auth.uid()));
CREATE POLICY "Lotti creabili da operatori attivi"
  ON public.prodotto_lotto FOR INSERT TO authenticated
  WITH CHECK (is_active_operator(auth.uid()));
CREATE POLICY "Lotti modificabili da operatori attivi"
  ON public.prodotto_lotto FOR UPDATE TO authenticated
  USING (is_active_operator(auth.uid()));
CREATE POLICY "Solo medici eliminano lotti"
  ON public.prodotto_lotto FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'medico'::app_role));

-- ============================================================
-- 5. MOVIMENTI MAGAZZINO (append-only)
-- ============================================================
CREATE TABLE public.magazzino_movimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prodotto_id uuid NOT NULL REFERENCES public.prodotto(id) ON DELETE RESTRICT,
  lotto_id uuid REFERENCES public.prodotto_lotto(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('carico','scarico','rettifica_pos','rettifica_neg','scarto_scadenza')),
  quantita numeric(12,2) NOT NULL CHECK (quantita > 0),
  costo_unitario numeric(12,2),
  seduta_id uuid REFERENCES public.seduta(id) ON DELETE SET NULL,
  paziente_id uuid REFERENCES public.pazienti(id) ON DELETE SET NULL,
  operatore_id uuid,
  note text,
  motivazione text,
  modalita_snapshot text,
  data_movimento timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mag_mov_prodotto_idx ON public.magazzino_movimento (prodotto_id, data_movimento DESC);
CREATE INDEX mag_mov_lotto_idx ON public.magazzino_movimento (lotto_id);
CREATE INDEX mag_mov_seduta_idx ON public.magazzino_movimento (seduta_id);
CREATE INDEX mag_mov_paziente_idx ON public.magazzino_movimento (paziente_id);
CREATE INDEX mag_mov_data_idx ON public.magazzino_movimento (data_movimento DESC);

ALTER TABLE public.magazzino_movimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Movimenti visibili a operatori attivi"
  ON public.magazzino_movimento FOR SELECT TO authenticated
  USING (is_active_operator(auth.uid()));
CREATE POLICY "Movimenti creabili da operatori attivi"
  ON public.magazzino_movimento FOR INSERT TO authenticated
  WITH CHECK (is_active_operator(auth.uid()) AND auth.uid() = operatore_id);
CREATE POLICY "Solo medici eliminano movimenti"
  ON public.magazzino_movimento FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'medico'::app_role));
-- Niente UPDATE: append-only

-- ============================================================
-- 6. TRIGGER: aggiorna quantita_disponibile in base ai movimenti
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_movimento_aggiorna_lotto()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  modalita text;
  delta numeric(12,2);
  nuova_qta numeric(12,2);
BEGIN
  -- Recupera modalità prodotto
  SELECT p.modalita_tracking INTO modalita
    FROM public.prodotto p WHERE p.id = NEW.prodotto_id;

  -- Snapshot della modalità nel movimento
  NEW.modalita_snapshot := modalita;

  -- Solo i prodotti tracciati aggiornano scorte
  IF modalita <> 'tracciato' OR NEW.lotto_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calcola delta in base al tipo
  delta := CASE NEW.tipo
    WHEN 'carico' THEN NEW.quantita
    WHEN 'rettifica_pos' THEN NEW.quantita
    WHEN 'scarico' THEN -NEW.quantita
    WHEN 'rettifica_neg' THEN -NEW.quantita
    WHEN 'scarto_scadenza' THEN -NEW.quantita
    ELSE 0
  END;

  UPDATE public.prodotto_lotto
     SET quantita_disponibile = quantita_disponibile + delta
   WHERE id = NEW.lotto_id
   RETURNING quantita_disponibile INTO nuova_qta;

  IF nuova_qta < 0 THEN
    RAISE EXCEPTION 'Quantità lotto non può diventare negativa (lotto %, qta risultante %)', NEW.lotto_id, nuova_qta;
  END IF;

  -- Per i carichi, aggiorna anche quantita_iniziale se il lotto è appena stato creato
  IF NEW.tipo = 'carico' THEN
    UPDATE public.prodotto_lotto
       SET quantita_iniziale = GREATEST(quantita_iniziale, quantita_disponibile)
     WHERE id = NEW.lotto_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_movimento_aggiorna_lotto
  BEFORE INSERT ON public.magazzino_movimento
  FOR EACH ROW EXECUTE FUNCTION public.trg_movimento_aggiorna_lotto();

-- ============================================================
-- 7. ESTENSIONE TABELLA SEDUTA
-- ============================================================
ALTER TABLE public.seduta
  ADD COLUMN IF NOT EXISTS magazzino_scaricato boolean NOT NULL DEFAULT false;

-- ============================================================
-- 8. FUNZIONE: consumo seduta con FEFO
-- ============================================================
-- Input: seduta_id, righe = jsonb array di { prodotto_id, lotto_id?, quantita, motivazione_no_scarico? }
-- Comportamento: per ogni riga, se prodotto = tracciato applica FEFO (o lotto specificato);
-- se solo_uso registra movimento informativo; se standby ignora.
CREATE OR REPLACE FUNCTION public.magazzino_consuma_seduta(
  _seduta_id uuid,
  _righe jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  pid uuid;
  riga jsonb;
  prod_id uuid;
  lotto_id uuid;
  qta numeric;
  modalita text;
  fefo_lotto uuid;
  warnings text[] := ARRAY[]::text[];
  scaricato_flag boolean;
BEGIN
  -- Recupera paziente e flag idempotenza
  SELECT s.paziente_id, s.magazzino_scaricato INTO pid, scaricato_flag
    FROM public.seduta s WHERE s.id = _seduta_id;
  IF pid IS NULL THEN
    RAISE EXCEPTION 'Seduta % non trovata', _seduta_id;
  END IF;
  IF scaricato_flag THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'già scaricata');
  END IF;

  FOR riga IN SELECT * FROM jsonb_array_elements(COALESCE(_righe, '[]'::jsonb))
  LOOP
    prod_id := (riga->>'prodotto_id')::uuid;
    lotto_id := NULLIF(riga->>'lotto_id','')::uuid;
    qta := (riga->>'quantita')::numeric;

    IF prod_id IS NULL OR qta IS NULL OR qta <= 0 THEN
      CONTINUE;
    END IF;

    SELECT p.modalita_tracking INTO modalita
      FROM public.prodotto p WHERE p.id = prod_id;

    IF modalita IS NULL OR modalita = 'standby' THEN
      warnings := array_append(warnings, format('prodotto %s ignorato (standby o inesistente)', prod_id));
      CONTINUE;
    END IF;

    IF modalita = 'tracciato' THEN
      -- Se lotto non specificato, applica FEFO
      IF lotto_id IS NULL THEN
        SELECT id INTO fefo_lotto
          FROM public.prodotto_lotto
         WHERE prodotto_id = prod_id
           AND quantita_disponibile >= qta
         ORDER BY data_scadenza NULLS LAST, created_at ASC
         LIMIT 1;
        IF fefo_lotto IS NULL THEN
          warnings := array_append(warnings, format('nessun lotto disponibile per prodotto %s qta %s', prod_id, qta));
          CONTINUE;
        END IF;
        lotto_id := fefo_lotto;
      END IF;

      INSERT INTO public.magazzino_movimento (
        prodotto_id, lotto_id, tipo, quantita,
        seduta_id, paziente_id, operatore_id, note
      ) VALUES (
        prod_id, lotto_id, 'scarico', qta,
        _seduta_id, pid, uid, 'Scarico automatico seduta'
      );
    ELSIF modalita = 'solo_uso' THEN
      -- Movimento informativo: lotto opzionale
      INSERT INTO public.magazzino_movimento (
        prodotto_id, lotto_id, tipo, quantita,
        seduta_id, paziente_id, operatore_id, note
      ) VALUES (
        prod_id, lotto_id, 'scarico', qta,
        _seduta_id, pid, uid, 'Registrazione consumo (solo uso)'
      );
    END IF;
  END LOOP;

  -- Marca seduta come scaricata
  UPDATE public.seduta SET magazzino_scaricato = true WHERE id = _seduta_id;

  RETURN jsonb_build_object('ok', true, 'warnings', warnings);
END;
$$;

-- ============================================================
-- 9. FUNZIONE: ripristino seduta (de-completamento)
-- ============================================================
CREATE OR REPLACE FUNCTION public.magazzino_ripristina_seduta(_seduta_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  m record;
BEGIN
  FOR m IN
    SELECT * FROM public.magazzino_movimento
     WHERE seduta_id = _seduta_id
       AND tipo IN ('scarico')
       AND modalita_snapshot = 'tracciato'
  LOOP
    -- Crea movimento di reintegro (rettifica_pos)
    INSERT INTO public.magazzino_movimento (
      prodotto_id, lotto_id, tipo, quantita,
      seduta_id, paziente_id, operatore_id, note, motivazione
    ) VALUES (
      m.prodotto_id, m.lotto_id, 'rettifica_pos', m.quantita,
      _seduta_id, m.paziente_id, uid, 'Reintegro per de-completamento seduta',
      'Reverse automatico'
    );
  END LOOP;
  UPDATE public.seduta SET magazzino_scaricato = false WHERE id = _seduta_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- 10. SEED MARCHE COMUNI (per partire)
-- ============================================================
INSERT INTO public.prodotto_marca (nome) VALUES
  ('Allergan'), ('Galderma'), ('IBSA'), ('Teoxane'), ('Merz'), ('Generico')
ON CONFLICT DO NOTHING;