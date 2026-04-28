CREATE POLICY "Draft anamnesi eliminabili da operatori attivi"
ON public.anamnesi
FOR DELETE
TO authenticated
USING (is_active_operator(auth.uid()) AND stato = 'draft');