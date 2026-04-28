-- A1: Rimuove vincolo legacy che impedisce versioning anamnesi
ALTER TABLE public.anamnesi DROP CONSTRAINT IF EXISTS anamnesi_paziente_id_key;

-- Garantisce al massimo UNA bozza attiva per paziente (previene draft duplicati)
CREATE UNIQUE INDEX IF NOT EXISTS anamnesi_one_draft_per_paziente
  ON public.anamnesi(paziente_id)
  WHERE stato = 'draft';

-- Indice di supporto per query per paziente+stato
CREATE INDEX IF NOT EXISTS anamnesi_paziente_stato_idx
  ON public.anamnesi(paziente_id, stato);

-- C4: Tabelle per condivisione consensi via link sicuro
CREATE TABLE IF NOT EXISTS public.consenso_share_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consenso_id uuid NOT NULL REFERENCES public.consenso_firmato(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS consenso_share_link_consenso_idx
  ON public.consenso_share_link(consenso_id);

ALTER TABLE public.consenso_share_link ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Share link visibili a operatori attivi"
  ON public.consenso_share_link FOR SELECT TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Share link creabili da operatori attivi"
  ON public.consenso_share_link FOR INSERT TO authenticated
  WITH CHECK (public.is_active_operator(auth.uid()));

CREATE POLICY "Share link revocabili da operatori attivi"
  ON public.consenso_share_link FOR UPDATE TO authenticated
  USING (public.is_active_operator(auth.uid()));

CREATE POLICY "Solo medici eliminano share link"
  ON public.consenso_share_link FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'medico'::app_role));

-- Log accessi pubblici al link
CREATE TABLE IF NOT EXISTS public.consenso_share_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.consenso_share_link(id) ON DELETE CASCADE,
  ip text,
  user_agent text,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consenso_share_access_log_share_idx
  ON public.consenso_share_access_log(share_id);

ALTER TABLE public.consenso_share_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo medici leggono access log share"
  ON public.consenso_share_access_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'medico'::app_role));
-- INSERT solo via edge function con service role: nessuna policy authenticated INSERT