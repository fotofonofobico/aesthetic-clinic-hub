-- Enum tipi evento calendario
CREATE TYPE public.calendario_evento_tipo AS ENUM ('promemoria', 'follow_up', 'attivita', 'altro');

-- Tabella eventi calendario (isolata, nessuna FK hard verso tabelle core)
CREATE TABLE public.evento_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titolo text NOT NULL,
  descrizione text,
  data_inizio timestamptz NOT NULL,
  data_fine timestamptz,
  tutto_il_giorno boolean NOT NULL DEFAULT false,
  tipo public.calendario_evento_tipo NOT NULL DEFAULT 'promemoria',
  paziente_id uuid,
  seduta_id uuid,
  colore text,
  completato boolean NOT NULL DEFAULT false,
  sincronizza_diario boolean NOT NULL DEFAULT false,
  nota_diario_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_evento_calendario_data_inizio ON public.evento_calendario (data_inizio);
CREATE INDEX idx_evento_calendario_paziente ON public.evento_calendario (paziente_id) WHERE paziente_id IS NOT NULL;
CREATE INDEX idx_evento_calendario_seduta ON public.evento_calendario (seduta_id) WHERE seduta_id IS NOT NULL;

ALTER TABLE public.evento_calendario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eventi calendario visibili a operatori attivi"
  ON public.evento_calendario FOR SELECT TO authenticated
  USING (is_active_operator(auth.uid()));

CREATE POLICY "Eventi calendario creabili da operatori attivi"
  ON public.evento_calendario FOR INSERT TO authenticated
  WITH CHECK (is_active_operator(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Eventi calendario modificabili da operatori attivi"
  ON public.evento_calendario FOR UPDATE TO authenticated
  USING (is_active_operator(auth.uid()));

CREATE POLICY "Eventi calendario eliminabili da autore o medico"
  ON public.evento_calendario FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'medico'::app_role));

CREATE TRIGGER trg_evento_calendario_updated_at
  BEFORE UPDATE ON public.evento_calendario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Preferenze calendario per utente
CREATE TABLE public.calendario_preferenze (
  user_id uuid PRIMARY KEY,
  followup_auto_attivo boolean NOT NULL DEFAULT false,
  followup_giorni_offset integer NOT NULL DEFAULT 7,
  vista_default text NOT NULL DEFAULT 'settimana',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.calendario_preferenze ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Preferenze calendario visibili al proprio utente"
  ON public.calendario_preferenze FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Preferenze calendario inseribili dal proprio utente"
  ON public.calendario_preferenze FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Preferenze calendario modificabili dal proprio utente"
  ON public.calendario_preferenze FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_calendario_preferenze_updated_at
  BEFORE UPDATE ON public.calendario_preferenze
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();