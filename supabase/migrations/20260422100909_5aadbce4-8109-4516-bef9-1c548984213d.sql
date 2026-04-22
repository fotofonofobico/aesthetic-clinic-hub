-- =========================================
-- ENUM RUOLI
-- =========================================
CREATE TYPE public.app_role AS ENUM ('medico', 'collaboratore');

-- =========================================
-- TABELLA PROFILES
-- =========================================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  cognome TEXT NOT NULL DEFAULT '',
  qualifica TEXT,
  numero_albo TEXT,
  telefono TEXT,
  attivo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- TABELLA USER_ROLES (separata da profiles!)
-- =========================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- =========================================
-- FUNZIONE has_role (SECURITY DEFINER, evita ricorsione RLS)
-- =========================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =========================================
-- TABELLA AUDIT_LOG
-- =========================================
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_log_user ON public.audit_log(user_id);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);

-- =========================================
-- RLS POLICIES — PROFILES
-- =========================================
CREATE POLICY "Operatori vedono il proprio profilo"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Medici vedono tutti i profili"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'medico'));

CREATE POLICY "Operatori aggiornano il proprio profilo"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Medici aggiornano tutti i profili"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'medico'));

CREATE POLICY "Inserimento profilo solo via trigger"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =========================================
-- RLS POLICIES — USER_ROLES
-- =========================================
CREATE POLICY "Tutti gli autenticati vedono i ruoli"
ON public.user_roles FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Solo medici assegnano ruoli"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'medico'));

CREATE POLICY "Solo medici modificano ruoli"
ON public.user_roles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'medico'));

CREATE POLICY "Solo medici eliminano ruoli"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'medico'));

-- =========================================
-- RLS POLICIES — AUDIT_LOG
-- =========================================
CREATE POLICY "Solo medici leggono audit log"
ON public.audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'medico'));

CREATE POLICY "Operatori autenticati possono scrivere audit"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =========================================
-- TRIGGER updated_at
-- =========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- TRIGGER auto-creazione profilo + primo utente = medico
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  -- Crea profilo
  INSERT INTO public.profiles (user_id, nome, cognome)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    COALESCE(NEW.raw_user_meta_data->>'cognome', '')
  );

  -- Verifica se è il primo utente del sistema
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first_user;

  -- Primo utente = medico (admin), tutti gli altri = collaboratore
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE WHEN is_first_user THEN 'medico'::app_role ELSE 'collaboratore'::app_role END
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();