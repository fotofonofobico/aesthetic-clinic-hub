CREATE POLICY "Anamnesi PDF aggiornabili da operatori attivi"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'anamnesi-pdf' AND public.is_active_operator(auth.uid()))
WITH CHECK (bucket_id = 'anamnesi-pdf' AND public.is_active_operator(auth.uid()));