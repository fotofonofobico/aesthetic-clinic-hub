
-- Revoke EXECUTE from public/anon/authenticated on all SECURITY DEFINER functions in public schema
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   fn.nspname, fn.proname, fn.args);
  END LOOP;
END $$;

-- Re-grant EXECUTE to authenticated only for functions invoked as RPC by the app
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_consenso_valido(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_operator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.paziente_consensi_stato(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.magazzino_consuma_seduta(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.magazzino_ripristina_seduta(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.piano_foto_riapri(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.piano_foto_marca_non_eseguibile(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.firma_sessione_marca_scadute() TO authenticated;
