ALTER TABLE public.piano_trattamento_voce
  ADD COLUMN IF NOT EXISTS prodotti_previsti jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.seduta
  ADD COLUMN IF NOT EXISTS prodotti_previsti jsonb NOT NULL DEFAULT '[]'::jsonb;