
-- 1) Piano: prezzo pacchetto override + storno visita
ALTER TABLE public.piano_trattamento
  ADD COLUMN IF NOT EXISTS prezzo_pacchetto_override numeric,
  ADD COLUMN IF NOT EXISTS storno_visita_seduta_id uuid,
  ADD COLUMN IF NOT EXISTS storno_visita_importo numeric;

COMMENT ON COLUMN public.piano_trattamento.prezzo_pacchetto_override IS
  'Se valorizzato, sostituisce la somma delle voci come base di calcolo del totale del piano (prezzo pacchetto fisso).';
COMMENT ON COLUMN public.piano_trattamento.storno_visita_seduta_id IS
  'FK opzionale alla seduta (visita) il cui importo viene stornato dal totale di questo piano.';
COMMENT ON COLUMN public.piano_trattamento.storno_visita_importo IS
  'Importo dello storno visita (snapshot al momento dell''attivazione del piano).';

-- 2) Seduta: flag "scalata in piano X" per evitare doppio storno
ALTER TABLE public.seduta
  ADD COLUMN IF NOT EXISTS scalata_in_piano_id uuid;

COMMENT ON COLUMN public.seduta.scalata_in_piano_id IS
  'Quando valorizzato, indica che il costo di questa seduta (tipicamente una visita) è già stato stornato dentro un piano. Impedisce doppi storni.';

CREATE INDEX IF NOT EXISTS idx_seduta_scalata_in_piano
  ON public.seduta(scalata_in_piano_id)
  WHERE scalata_in_piano_id IS NOT NULL;

-- 3) Consenso template: rifirma su nuova versione opt-in
ALTER TABLE public.consenso_template
  ADD COLUMN IF NOT EXISTS richiede_rifirma_su_nuova_versione boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_nuova_versione text;

COMMENT ON COLUMN public.consenso_template.richiede_rifirma_su_nuova_versione IS
  'Se true, il versionamento del template forza la rifirma dei consensi già raccolti. Default false: una nuova versione non invalida i consensi precedenti finché restano nel periodo di validità.';
COMMENT ON COLUMN public.consenso_template.motivo_nuova_versione IS
  'Nota libera sul perché è stata creata l''ultima versione del template (es. "aggiornata clausola privacy"). Mostrata nei dialog di alert.';
