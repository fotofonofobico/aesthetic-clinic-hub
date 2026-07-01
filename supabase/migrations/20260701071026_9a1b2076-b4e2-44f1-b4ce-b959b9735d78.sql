ALTER TABLE public.firma_sessione
  ADD COLUMN IF NOT EXISTS paziente_step_corrente INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paziente_step_totale   INTEGER NOT NULL DEFAULT 0;