-- =========================================
-- CATALOGO TRATTAMENTI
-- =========================================
CREATE TABLE public.trattamenti (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  categoria TEXT,
  descrizione TEXT,
  durata_minuti INTEGER,
  prezzo_indicativo NUMERIC(10,2),
  attivo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.trattamenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trattamenti visibili a operatori attivi"
ON public.trattamenti FOR SELECT TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Solo medici creano trattamenti"
ON public.trattamenti FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'medico'::app_role));

CREATE POLICY "Solo medici modificano trattamenti"
ON public.trattamenti FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'medico'::app_role));

CREATE POLICY "Solo medici eliminano trattamenti"
ON public.trattamenti FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'medico'::app_role));

CREATE TRIGGER update_trattamenti_updated_at
BEFORE UPDATE ON public.trattamenti
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- TEMPLATE CONSENSI
-- =========================================
CREATE TABLE public.consenso_template (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trattamento_id UUID REFERENCES public.trattamenti(id) ON DELETE SET NULL,
  titolo TEXT NOT NULL,
  testo TEXT NOT NULL,
  versione TEXT NOT NULL DEFAULT '1.0',
  attivo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consenso_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Template consenso visibili a operatori attivi"
ON public.consenso_template FOR SELECT TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Solo medici creano template"
ON public.consenso_template FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'medico'::app_role));

CREATE POLICY "Solo medici modificano template"
ON public.consenso_template FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'medico'::app_role));

CREATE POLICY "Solo medici eliminano template"
ON public.consenso_template FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'medico'::app_role));

CREATE TRIGGER update_consenso_template_updated_at
BEFORE UPDATE ON public.consenso_template
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- CONSENSI FIRMATI
-- =========================================
CREATE TABLE public.consenso_firmato (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paziente_id UUID NOT NULL REFERENCES public.pazienti(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.consenso_template(id) ON DELETE SET NULL,
  titolo_snapshot TEXT NOT NULL,
  testo_snapshot TEXT NOT NULL,
  versione_snapshot TEXT NOT NULL,
  firma_immagine TEXT NOT NULL,
  firmato_il TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_dispositivo TEXT,
  user_agent TEXT,
  operatore_testimone UUID,
  hash_integrita TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consenso_firmato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consensi firmati visibili a operatori attivi"
ON public.consenso_firmato FOR SELECT TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Consensi firmati creabili da operatori attivi"
ON public.consenso_firmato FOR INSERT TO authenticated
WITH CHECK (public.is_active_operator(auth.uid()));

CREATE POLICY "Solo medici eliminano consensi firmati"
ON public.consenso_firmato FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'medico'::app_role));

CREATE INDEX idx_consenso_firmato_paziente ON public.consenso_firmato(paziente_id);

-- =========================================
-- PIANI DI TRATTAMENTO
-- =========================================
CREATE TYPE public.piano_stato AS ENUM ('attivo', 'completato', 'sospeso', 'annullato');

CREATE TABLE public.piano_trattamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paziente_id UUID NOT NULL REFERENCES public.pazienti(id) ON DELETE CASCADE,
  trattamento_id UUID REFERENCES public.trattamenti(id) ON DELETE SET NULL,
  titolo TEXT NOT NULL,
  numero_sedute_previste INTEGER NOT NULL DEFAULT 1,
  prezzo_totale NUMERIC(10,2),
  stato public.piano_stato NOT NULL DEFAULT 'attivo',
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.piano_trattamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Piani visibili a operatori attivi"
ON public.piano_trattamento FOR SELECT TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Piani creabili da operatori attivi"
ON public.piano_trattamento FOR INSERT TO authenticated
WITH CHECK (public.is_active_operator(auth.uid()));

CREATE POLICY "Piani modificabili da operatori attivi"
ON public.piano_trattamento FOR UPDATE TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Solo medici eliminano piani"
ON public.piano_trattamento FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'medico'::app_role));

CREATE TRIGGER update_piano_trattamento_updated_at
BEFORE UPDATE ON public.piano_trattamento
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_piano_paziente ON public.piano_trattamento(paziente_id);

-- =========================================
-- SEDUTE
-- =========================================
CREATE TABLE public.seduta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  piano_id UUID NOT NULL REFERENCES public.piano_trattamento(id) ON DELETE CASCADE,
  paziente_id UUID NOT NULL REFERENCES public.pazienti(id) ON DELETE CASCADE,
  numero_seduta INTEGER NOT NULL DEFAULT 1,
  data_seduta TIMESTAMPTZ NOT NULL DEFAULT now(),
  durata_minuti INTEGER,
  operatore_id UUID,
  parametri_tecnici JSONB NOT NULL DEFAULT '{}'::jsonb,
  note_cliniche TEXT,
  completata BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seduta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sedute visibili a operatori attivi"
ON public.seduta FOR SELECT TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Sedute creabili da operatori attivi"
ON public.seduta FOR INSERT TO authenticated
WITH CHECK (public.is_active_operator(auth.uid()));

CREATE POLICY "Sedute modificabili da operatori attivi"
ON public.seduta FOR UPDATE TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Solo medici eliminano sedute"
ON public.seduta FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'medico'::app_role));

CREATE TRIGGER update_seduta_updated_at
BEFORE UPDATE ON public.seduta
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_seduta_piano ON public.seduta(piano_id);
CREATE INDEX idx_seduta_paziente ON public.seduta(paziente_id);

-- =========================================
-- FOLLOW-UP
-- =========================================
CREATE TABLE public.followup (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seduta_id UUID NOT NULL REFERENCES public.seduta(id) ON DELETE CASCADE,
  paziente_id UUID NOT NULL REFERENCES public.pazienti(id) ON DELETE CASCADE,
  data_followup TIMESTAMPTZ NOT NULL DEFAULT now(),
  esito TEXT,
  foto JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT,
  complicanza_segnalata BOOLEAN NOT NULL DEFAULT false,
  complicanza_descrizione TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.followup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Followup visibili a operatori attivi"
ON public.followup FOR SELECT TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Followup creabili da operatori attivi"
ON public.followup FOR INSERT TO authenticated
WITH CHECK (public.is_active_operator(auth.uid()));

CREATE POLICY "Followup modificabili da operatori attivi"
ON public.followup FOR UPDATE TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Solo medici eliminano followup"
ON public.followup FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'medico'::app_role));

CREATE TRIGGER update_followup_updated_at
BEFORE UPDATE ON public.followup
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_followup_seduta ON public.followup(seduta_id);
CREATE INDEX idx_followup_paziente ON public.followup(paziente_id);