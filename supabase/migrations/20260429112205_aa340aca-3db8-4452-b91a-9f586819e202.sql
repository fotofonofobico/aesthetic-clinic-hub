-- Tabella info studio (singleton)
CREATE TABLE IF NOT EXISTS public.studio_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ragione_sociale text,
  partita_iva text,
  codice_fiscale text,
  indirizzo text,
  citta text,
  cap text,
  provincia text,
  telefono text,
  email text,
  pec text,
  sito_web text,
  logo_url text,
  direttore_sanitario text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.studio_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Studio visibile a operatori attivi"
ON public.studio_info FOR SELECT TO authenticated
USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Solo medici inseriscono studio"
ON public.studio_info FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'medico'::app_role));

CREATE POLICY "Solo medici aggiornano studio"
ON public.studio_info FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'medico'::app_role));

CREATE POLICY "Solo medici eliminano studio"
ON public.studio_info FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'medico'::app_role));

CREATE TRIGGER update_studio_info_updated_at
BEFORE UPDATE ON public.studio_info
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket per logo
INSERT INTO storage.buckets (id, name, public)
VALUES ('studio-assets', 'studio-assets', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Studio assets visibili agli autenticati"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'studio-assets');

CREATE POLICY "Solo medici caricano studio assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'studio-assets' AND public.has_role(auth.uid(), 'medico'::app_role));

CREATE POLICY "Solo medici aggiornano studio assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'studio-assets' AND public.has_role(auth.uid(), 'medico'::app_role));

CREATE POLICY "Solo medici eliminano studio assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'studio-assets' AND public.has_role(auth.uid(), 'medico'::app_role));