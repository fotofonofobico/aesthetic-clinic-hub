import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

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

    // allSettled: un KPI rotto non oscura l'altro. Per i fallimenti il valore
    // resta null (UI mostra "–"), non lo forziamo a 0 per non simulare dati reali.
    Promise.allSettled([
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
      .then((results) => {
        if (cancelled) return;
        const [pzRes, sdRes] = results;
        const nuoviPazienti =
          pzRes.status === "fulfilled" ? (pzRes.value.count ?? 0) : null;
        const trattamentiCompletati =
          sdRes.status === "fulfilled" ? (sdRes.value.count ?? 0) : null;
        if (pzRes.status === "rejected") {
          logger.error("[useKpiMese] pazienti", pzRes.reason);
        }
        if (sdRes.status === "rejected") {
          logger.error("[useKpiMese] sedute", sdRes.reason);
        }
        setData((d) => ({ ...d, nuoviPazienti, trattamentiCompletati }));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error("[useKpiMese]", err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}
