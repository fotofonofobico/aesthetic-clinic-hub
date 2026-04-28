
-- Auto-supersede: quando un'anamnesi viene firmata, marca le altre signed dello stesso paziente come superseded
CREATE OR REPLACE FUNCTION public.anamnesi_auto_supersede()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.stato <> 'signed' AND NEW.stato = 'signed')
     OR (TG_OP = 'INSERT' AND NEW.stato = 'signed') THEN
    UPDATE public.anamnesi
       SET stato = 'superseded'
     WHERE paziente_id = NEW.paziente_id
       AND id <> NEW.id
       AND stato = 'signed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anamnesi_auto_supersede ON public.anamnesi;
CREATE TRIGGER trg_anamnesi_auto_supersede
AFTER INSERT OR UPDATE OF stato ON public.anamnesi
FOR EACH ROW
EXECUTE FUNCTION public.anamnesi_auto_supersede();

-- Rafforza la protezione: blocca anche modifiche a firme/hash/pdf su record signed
CREATE OR REPLACE FUNCTION public.anamnesi_signed_protect()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.stato = 'signed' THEN
    -- Consenti solo signed -> superseded
    IF NEW.stato NOT IN ('signed', 'superseded') THEN
      RAISE EXCEPTION 'Anamnesi firmata: transizione di stato non consentita (%->%):', OLD.stato, NEW.stato;
    END IF;
    -- Se resta signed, vieta modifica dati clinici e firma
    IF NEW.stato = 'signed' THEN
      IF (NEW.generale IS DISTINCT FROM OLD.generale
          OR NEW.patologica IS DISTINCT FROM OLD.patologica
          OR NEW.farmacologica IS DISTINCT FROM OLD.farmacologica
          OR NEW.estetica IS DISTINCT FROM OLD.estetica
          OR NEW.note_libere IS DISTINCT FROM OLD.note_libere
          OR NEW.firma_paziente IS DISTINCT FROM OLD.firma_paziente
          OR NEW.firma_medico IS DISTINCT FROM OLD.firma_medico
          OR NEW.firmata_il IS DISTINCT FROM OLD.firmata_il
          OR NEW.hash_integrita IS DISTINCT FROM OLD.hash_integrita
          OR NEW.pdf_url IS DISTINCT FROM OLD.pdf_url
          OR NEW.versione_numero IS DISTINCT FROM OLD.versione_numero) THEN
        RAISE EXCEPTION 'Anamnesi firmata immutabile: crea una nuova versione';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Validazione consensi trattamento: forza scadenza coerente
CREATE OR REPLACE FUNCTION public.consenso_firmato_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.categoria_snapshot = 'trattamento_ciclo' AND NEW.valido_fino_a IS NULL THEN
    NEW.valido_fino_a := COALESCE(NEW.firmato_il, now())
      + (COALESCE(NEW.validita_mesi_snapshot, 12) || ' months')::interval;
  END IF;

  IF NEW.categoria_snapshot = 'trattamento_singolo' AND NEW.seduta_id IS NULL THEN
    -- Permettiamo l'inserimento ma scaduto subito? No: richiediamo associazione esplicita.
    -- Se non c'è seduta, lo trattiamo come singolo legato alla prima esecuzione (non blocchiamo qui per non rompere flussi esistenti).
    NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consenso_firmato_validate ON public.consenso_firmato;
CREATE TRIGGER trg_consenso_firmato_validate
BEFORE INSERT ON public.consenso_firmato
FOR EACH ROW
EXECUTE FUNCTION public.consenso_firmato_validate();
