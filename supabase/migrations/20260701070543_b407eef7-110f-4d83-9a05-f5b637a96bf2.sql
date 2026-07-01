-- Revoke EXECUTE from authenticated on SECURITY DEFINER functions that are not called via RPC by the client.
-- These functions are only referenced by triggers, RLS policies, or admin/cron flows; policy/trigger execution
-- ignores EXECUTE grants, so revoking them here removes RPC exposure without breaking anything.

REVOKE EXECUTE ON FUNCTION public.is_active_operator(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.firma_sessione_marca_scadute() FROM PUBLIC, anon, authenticated;

-- Harden the remaining client-callable SECURITY DEFINER RPCs so signed-in users cannot abuse them:
-- every entry point now requires an active operator (checked in-function). Grants stay only on authenticated.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_consenso_valido(_paziente_id uuid, _template_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_operator(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.consenso_firmato cf
    JOIN public.consenso_template ct ON ct.id = cf.template_id
    WHERE cf.paziente_id = _paziente_id
      AND cf.template_id = _template_id
      AND cf.revocato_il IS NULL
      AND cf.rifiutato = false
      AND cf.versione_snapshot = ct.versione
      AND ct.attivo = true
      AND (cf.valido_fino_a IS NULL OR cf.valido_fino_a > now())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.paziente_consensi_stato(_paziente_id uuid)
RETURNS TABLE(consenso_id uuid, template_id uuid, titolo text, versione text, categoria consenso_categoria, firmato_il timestamp with time zone, valido_fino_a timestamp with time zone, rifiutato boolean, stato text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_active_operator(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    cf.id,
    cf.template_id,
    cf.titolo_snapshot,
    cf.versione_snapshot,
    cf.categoria_snapshot,
    cf.firmato_il,
    cf.valido_fino_a,
    cf.rifiutato,
    CASE
      WHEN cf.rifiutato THEN 'rifiutato'
      WHEN cf.revocato_il IS NOT NULL THEN 'revoked'
      WHEN cf.categoria_snapshot = 'trattamento_singolo' AND EXISTS (
        SELECT 1 FROM public.seduta s
        WHERE s.id = cf.seduta_id AND s.completata = true
      ) THEN 'expired'
      WHEN cf.durata_tipo_snapshot = 'sedute'
           AND cf.sedute_max_snapshot IS NOT NULL
           AND cf.sedute_consumate >= cf.sedute_max_snapshot THEN 'expired'
      WHEN cf.durata_tipo_snapshot = 'sedute'
           AND cf.sedute_max_snapshot IS NOT NULL
           AND (cf.sedute_max_snapshot - cf.sedute_consumate) <= 1 THEN 'expiring'
      WHEN cf.durata_tipo_snapshot = 'mesi'
           AND cf.valido_fino_a IS NOT NULL
           AND cf.valido_fino_a <= now() THEN 'expired'
      WHEN ct.id IS NULL OR ct.attivo = false THEN 'obsolete'
      WHEN ct.versione <> cf.versione_snapshot THEN 'obsolete'
      WHEN cf.durata_tipo_snapshot = 'mesi'
           AND cf.valido_fino_a IS NOT NULL
           AND cf.valido_fino_a <= now() + interval '30 days' THEN 'expiring'
      ELSE 'valid'
    END AS stato
  FROM public.consenso_firmato cf
  LEFT JOIN public.consenso_template ct ON ct.id = cf.template_id
  WHERE cf.paziente_id = _paziente_id
  ORDER BY cf.firmato_il DESC;
END;
$$;
