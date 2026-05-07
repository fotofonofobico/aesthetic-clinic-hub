
-- Nuovi valori enum per piano_stato (decisione clinica)
ALTER TYPE piano_stato ADD VALUE IF NOT EXISTS 'in_attesa';
ALTER TYPE piano_stato ADD VALUE IF NOT EXISTS 'non_indicato';

-- Nuove colonne su piano_trattamento
ALTER TABLE public.piano_trattamento
  ADD COLUMN IF NOT EXISTS tipo_decisione text NOT NULL DEFAULT 'piano',
  ADD COLUMN IF NOT EXISTS trattamento_richiesto_id uuid REFERENCES public.trattamenti(id),
  ADD COLUMN IF NOT EXISTS trattamento_richiesto_testo text,
  ADD COLUMN IF NOT EXISTS attesa_tipo text,
  ADD COLUMN IF NOT EXISTS attesa_descrizione text,
  ADD COLUMN IF NOT EXISTS attesa_scadenza date,
  ADD COLUMN IF NOT EXISTS non_indicato_motivo text,
  ADD COLUMN IF NOT EXISTS decisione_nota text,
  ADD COLUMN IF NOT EXISTS convertito_da_piano_id uuid REFERENCES public.piano_trattamento(id);

-- Vincoli su valori ammessi
ALTER TABLE public.piano_trattamento
  DROP CONSTRAINT IF EXISTS piano_tipo_decisione_chk;
ALTER TABLE public.piano_trattamento
  ADD CONSTRAINT piano_tipo_decisione_chk
  CHECK (tipo_decisione IN ('piano','in_attesa','non_indicato'));

ALTER TABLE public.piano_trattamento
  DROP CONSTRAINT IF EXISTS piano_attesa_tipo_chk;
ALTER TABLE public.piano_trattamento
  ADD CONSTRAINT piano_attesa_tipo_chk
  CHECK (attesa_tipo IS NULL OR attesa_tipo IN ('documentazione','approfondimento','rivalutazione'));

ALTER TABLE public.piano_trattamento
  DROP CONSTRAINT IF EXISTS piano_non_indicato_motivo_chk;
ALTER TABLE public.piano_trattamento
  ADD CONSTRAINT piano_non_indicato_motivo_chk
  CHECK (non_indicato_motivo IS NULL OR non_indicato_motivo IN (
    'anatomia_non_idonea','aspettative_non_realistiche','controindicazione','paziente_ha_rifiutato','altro'
  ));

CREATE INDEX IF NOT EXISTS idx_piano_tipo_decisione
  ON public.piano_trattamento(tipo_decisione);
