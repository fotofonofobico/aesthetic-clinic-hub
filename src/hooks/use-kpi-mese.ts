import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface KpiMese {
  nuoviPazienti: number | null;
  trattamentiCompletati: number | null;
  fatturato: number | null;
  ticketMedio: number | null;
}

export function useKpiMese() {
  const [data, setData] = useState<KpiMese>({
    nuoviPazienti: null,
    trattamentiCompletati: null,
    fatturato: null, // TODO: collegare quando esiste fatturazione
    ticketMedio: null, // TODO: collegare quando esiste fatturazione
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const inizioMese = new Date();
    inizioMese.setDate(1);
    inizioMese.setHours(0, 0, 0, 0);
    const iso = inizioMese.toISOString();

    Promise.all([
      supabase
        .from("pazienti")
        .select("id", { count: "exact", head: true })
        .gte("created_at", iso)
        .is("deleted_at", null),
      supabase
        .from("seduta")
        .select("id", { count: "exact", head: true })
        .gte("data_seduta", iso)
        .eq("completata", true),
    ])
      .then(([pz, sd]) => {
        if (cancelled) return;
        setData((d) => ({
          ...d,
          nuoviPazienti: pz.count ?? 0,
          trattamentiCompletati: sd.count ?? 0,
        }));
        setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}
