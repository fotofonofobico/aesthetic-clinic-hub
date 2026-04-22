-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.sesso AS ENUM ('M', 'F', 'altro');
CREATE TYPE public.alert_severity AS ENUM ('info', 'attenzione', 'critico');

-- =========================================
-- FUNZIONE VALIDAZIONE CF
-- =========================================
CREATE OR REPLACE FUNCTION public.is_valid_cf(_cf TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT _cf IS NULL OR _cf = '' OR _cf ~ '^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$'
$$;

-- =========================================
-- TABELLA PAZIENTI
-- =========================================
CREATE TABLE public.pazienti (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  sesso sesso,
  data_nascita DATE,
  luogo_nascita TEXT,
  codice_fiscale TEXT,
  email TEXT,
  telefono TEXT,
  indirizzo TEXT,
  citta TEXT,
  cap TEXT,
  provincia TEXT,
  professione TEXT,
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT cf_format_valid CHECK (public.is_valid_cf(codice_fiscale))
);

CREATE INDEX idx_pazienti_cognome ON public.pazienti(cognome) WHERE deleted_at IS NULL;
CREATE INDEX idx_pazienti_cf ON public.pazienti(codice_fiscale) WHERE deleted_at IS NULL;
CREATE INDEX idx_pazienti_active ON public.pazienti(deleted_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uniq_pazienti_cf ON public.pazienti(codice_fiscale)
  WHERE codice_fiscale IS NOT NULL AND codice_fiscale <> '' AND deleted_at IS NULL;

ALTER TABLE public.pazienti ENABLE ROW LEVEL SECURITY;

-- =========================================
-- TABELLA PAZIENTE_ALERT
-- =========================================
CREATE TABLE public.paziente_alert (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paziente_id UUID NOT NULL REFERENCES public.pazienti(id) ON DELETE CASCADE,
  testo TEXT NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'attenzione',
  attivo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_paziente ON public.paziente_alert(paziente_id) WHERE attivo;

ALTER TABLE public.paziente_alert ENABLE ROW LEVEL SECURITY;

-- =========================================
-- TABELLA ANAMNESI
-- =========================================
CREATE TABLE public.anamnesi (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paziente_id UUID NOT NULL UNIQUE REFERENCES public.pazienti(id) ON DELETE CASCADE,
  generale JSONB NOT NULL DEFAULT '{}'::jsonb,
  patologica JSONB NOT NULL DEFAULT '{}'::jsonb,
  farmacologica JSONB NOT NULL DEFAULT '{}'::jsonb,
  allergologica JSONB NOT NULL DEFAULT '{}'::jsonb,
  ostetrica JSONB NOT NULL DEFAULT '{}'::jsonb,
  abitudini JSONB NOT NULL DEFAULT '{}'::jsonb,
  estetica JSONB NOT NULL DEFAULT '{}'::jsonb,
  note_libere TEXT,
  compilata_da UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.anamnesi ENABLE ROW LEVEL SECURITY;

-- =========================================
-- TABELLA ANAMNESI_FLAG_RISCHIO
-- =========================================
CREATE TABLE public.anamnesi_flag_rischio (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paziente_id UUID NOT NULL REFERENCES public.pazienti(id) ON DELETE CASCADE,
  codice TEXT NOT NULL,
  etichetta TEXT NOT NULL,
  severity alert_severity NOT NULL DEFAULT 'attenzione',
  origine TEXT NOT NULL DEFAULT 'auto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (paziente_id, codice)
);

CREATE INDEX idx_flag_paziente ON public.anamnesi_flag_rischio(paziente_id);

ALTER TABLE public.anamnesi_flag_rischio ENABLE ROW LEVEL SECURITY;

-- =========================================
-- TABELLA PAZIENTE_ACCESS_LOG
-- =========================================
CREATE TABLE public.paziente_access_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paziente_id UUID NOT NULL REFERENCES public.pazienti(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  azione TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pal_paziente ON public.paziente_access_log(paziente_id, created_at DESC);

ALTER TABLE public.paziente_access_log ENABLE ROW LEVEL SECURITY;

-- =========================================
-- FUNZIONE: utente attivo (in profiles.attivo)
-- =========================================
CREATE OR REPLACE FUNCTION public.is_active_operator(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND attivo = true
  )
$$;

-- =========================================
-- RLS — PAZIENTI
-- =========================================
CREATE POLICY "Operatori attivi vedono pazienti non eliminati"
ON public.pazienti FOR SELECT TO authenticated
USING (deleted_at IS NULL AND public.is_active_operator(auth.uid()));

CREATE POLICY "Medici vedono anche pazienti eliminati"
ON public.pazienti FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'medico'));

CREATE POLICY "Operatori attivi creano pazienti"
ON public.pazienti FOR INSERT TO authenticated
WITH CHECK (public.is_active_operator(auth.uid()));

CREATE POLICY "Operatori attivi aggiornano pazienti"
ON public.pazienti FOR UPDATE TO authenticated
USING (public.is_active_operator(auth.uid()));

-- Niente DELETE: solo soft-delete via UPDATE (gestito da RLS UPDATE).
-- Aggiungiamo policy DELETE solo per i medici per casi eccezionali.
CREATE POLICY "Solo medici cancellano definitivamente"
ON public.pazienti FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'medico'));

-- =========================================
-- RLS — PAZIENTE_ALERT
-- =========================================
CREATE POLICY "Alert visibili a operatori attivi"
ON public.paziente_alert FOR SELECT TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Alert creabili da operatori attivi"
ON public.paziente_alert FOR INSERT TO authenticated
WITH CHECK (public.is_active_operator(auth.uid()));

CREATE POLICY "Alert modificabili da operatori attivi"
ON public.paziente_alert FOR UPDATE TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Alert eliminabili da operatori attivi"
ON public.paziente_alert FOR DELETE TO authenticated
USING (public.is_active_operator(auth.uid()));

-- =========================================
-- RLS — ANAMNESI
-- =========================================
CREATE POLICY "Anamnesi visibile a operatori attivi"
ON public.anamnesi FOR SELECT TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Anamnesi creabile da operatori attivi"
ON public.anamnesi FOR INSERT TO authenticated
WITH CHECK (public.is_active_operator(auth.uid()));

CREATE POLICY "Anamnesi modificabile da operatori attivi"
ON public.anamnesi FOR UPDATE TO authenticated
USING (public.is_active_operator(auth.uid()));

-- =========================================
-- RLS — ANAMNESI_FLAG_RISCHIO
-- =========================================
CREATE POLICY "Flag visibili a operatori attivi"
ON public.anamnesi_flag_rischio FOR SELECT TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Flag creabili da operatori attivi"
ON public.anamnesi_flag_rischio FOR INSERT TO authenticated
WITH CHECK (public.is_active_operator(auth.uid()));

CREATE POLICY "Flag modificabili da operatori attivi"
ON public.anamnesi_flag_rischio FOR UPDATE TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Flag eliminabili da operatori attivi"
ON public.anamnesi_flag_rischio FOR DELETE TO authenticated
USING (public.is_active_operator(auth.uid()));

-- =========================================
-- RLS — PAZIENTE_ACCESS_LOG
-- =========================================
CREATE POLICY "Solo medici leggono access log paziente"
ON public.paziente_access_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'medico'));

CREATE POLICY "Operatori scrivono propri access log"
ON public.paziente_access_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =========================================
-- TRIGGER updated_at
-- =========================================
CREATE TRIGGER trg_pazienti_updated_at
BEFORE UPDATE ON public.pazienti
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_anamnesi_updated_at
BEFORE UPDATE ON public.anamnesi
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- TRIGGER: auto-creazione anamnesi vuota alla creazione paziente
-- =========================================
CREATE OR REPLACE FUNCTION public.create_empty_anamnesi()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.anamnesi (paziente_id, compilata_da)
  VALUES (NEW.id, NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_paziente_anamnesi
AFTER INSERT ON public.pazienti
FOR EACH ROW EXECUTE FUNCTION public.create_empty_anamnesi();