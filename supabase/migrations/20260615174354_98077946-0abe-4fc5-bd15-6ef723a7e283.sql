
-- Fix 1: firma_sessione — scope SELECT/UPDATE to the session creator only
DROP POLICY IF EXISTS "Sessioni firma visibili a operatori attivi" ON public.firma_sessione;
CREATE POLICY "Sessioni firma visibili al creatore"
  ON public.firma_sessione FOR SELECT
  USING (is_active_operator(auth.uid()) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Sessioni firma aggiornabili da operatori attivi" ON public.firma_sessione;
CREATE POLICY "Sessioni firma aggiornabili dal creatore"
  ON public.firma_sessione FOR UPDATE
  USING (is_active_operator(auth.uid()) AND auth.uid() = created_by);

-- Fix 2: storage studio-assets — require active operator
DROP POLICY IF EXISTS "Studio assets visibili agli autenticati" ON storage.objects;
CREATE POLICY "Studio assets visibili a operatori attivi"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'studio-assets' AND public.is_active_operator(auth.uid()));
