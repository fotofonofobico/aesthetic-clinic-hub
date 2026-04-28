
ALTER TYPE public.consenso_categoria RENAME VALUE 'trattamento_continuativo' TO 'trattamento_ciclo';
ALTER TYPE public.consenso_categoria RENAME VALUE 'gdpr_generale' TO 'gdpr';
ALTER TYPE public.consenso_categoria ADD VALUE IF NOT EXISTS 'uso_immagini';
ALTER TYPE public.consenso_categoria ADD VALUE IF NOT EXISTS 'anamnesi';

DROP FUNCTION IF EXISTS public.paziente_consensi_stato(uuid);

DO $$ BEGIN
  CREATE TYPE public.anamnesi_stato AS ENUM ('draft', 'signed', 'superseded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE public.piano_stato ADD VALUE IF NOT EXISTS 'bozza';
ALTER TYPE public.piano_stato ADD VALUE IF NOT EXISTS 'confermato';
