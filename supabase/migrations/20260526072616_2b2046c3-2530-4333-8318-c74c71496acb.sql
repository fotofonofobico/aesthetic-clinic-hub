DROP POLICY IF EXISTS "Tutti gli autenticati vedono i ruoli" ON public.user_roles;

CREATE POLICY "Ognuno vede il proprio ruolo, medici vedono tutti"
ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'medico'::app_role)
);

CREATE OR REPLACE FUNCTION public.piano_stato_sync_foto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stato = 'annullato' AND (OLD.stato IS DISTINCT FROM 'annullato') THEN
    INSERT INTO public.piano_foto_stato (piano_id, stato, motivazione, cambiato_il)
    VALUES (NEW.id, 'non_eseguibile', 'Piano annullato', now())
    ON CONFLICT (piano_id) DO UPDATE
      SET stato = 'non_eseguibile',
          motivazione = 'Piano annullato',
          cambiato_il = now();
  ELSIF OLD.stato = 'annullato' AND NEW.stato <> 'annullato' THEN
    UPDATE public.piano_foto_stato
       SET stato = 'baseline_mancante',
           motivazione = NULL,
           cambiato_il = now()
     WHERE piano_id = NEW.id
       AND stato = 'non_eseguibile'
       AND motivazione = 'Piano annullato';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_piano_stato_sync_foto ON public.piano_trattamento;
CREATE TRIGGER trg_piano_stato_sync_foto
AFTER UPDATE OF stato ON public.piano_trattamento
FOR EACH ROW EXECUTE FUNCTION public.piano_stato_sync_foto();

INSERT INTO public.piano_foto_stato (piano_id, stato, motivazione, cambiato_il)
SELECT p.id, 'non_eseguibile', 'Piano annullato', now()
FROM public.piano_trattamento p
WHERE p.stato = 'annullato'
ON CONFLICT (piano_id) DO UPDATE
  SET stato = 'non_eseguibile',
      motivazione = COALESCE(public.piano_foto_stato.motivazione, 'Piano annullato'),
      cambiato_il = now()
WHERE public.piano_foto_stato.stato = 'baseline_mancante';