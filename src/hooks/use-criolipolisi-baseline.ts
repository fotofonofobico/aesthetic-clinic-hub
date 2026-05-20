import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isTrattamentoCriolipolisi } from "@/lib/trattamenti-speciali";

export interface CriolipolisiBaselineState {
  loading: boolean;
  /** true se il paziente ha almeno un piano attivo di criolipolisi */
  haCriolipolisi: boolean;
  /** elenco dati mancanti: "peso", "altezza", "misurazione baseline" */
  missing: string[];
  /** true se haCriolipolisi && missing.length > 0 */
  showAlert: boolean;
  reload: () => void;
}

/**
 * Hook condiviso: calcola lo stato baseline per la criolipolisi di un paziente.
 * Usato sia dal banner in pazienti.$id sia dal reminder nel dialog "Completa seduta".
 */
export function useCriolipolisiBaseline(pazienteId: string | null | undefined): CriolipolisiBaselineState {
  const [loading, setLoading] = useState(true);
  const [haCriolipolisi, setHaCriolipolisi] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!pazienteId) {
      setLoading(false);
      setHaCriolipolisi(false);
      setMissing([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const { data: piani } = await supabase
          .from("piano_trattamento")
          .select("id")
          .eq("paziente_id", pazienteId)
          .not("stato", "in", "(annullato,sospeso,bozza,non_indicato)");
        const ids = (piani ?? []).map((p) => (p as { id: string }).id);
        if (ids.length === 0) {
          if (!cancelled) {
            setHaCriolipolisi(false);
            setMissing([]);
          }
          return;
        }
        const { data: voci } = await supabase
          .from("piano_trattamento_voce")
          .select("trattamento_id")
          .in("piano_id", ids);
        const trattIds = Array.from(
          new Set(
            (voci ?? [])
              .map((v) => (v as { trattamento_id: string | null }).trattamento_id)
              .filter((x): x is string => !!x),
          ),
        );
        if (trattIds.length === 0) {
          if (!cancelled) {
            setHaCriolipolisi(false);
            setMissing([]);
          }
          return;
        }
        const { data: tratt } = await supabase
          .from("trattamenti")
          .select("id, nome")
          .in("id", trattIds);
        const haCrio = (tratt ?? []).some((t) =>
          isTrattamentoCriolipolisi((t as { nome: string }).nome),
        );
        if (!haCrio) {
          if (!cancelled) {
            setHaCriolipolisi(false);
            setMissing([]);
          }
          return;
        }
        const [{ count }, pazRes] = await Promise.all([
          supabase
            .from("paziente_misurazione")
            .select("id", { count: "exact", head: true })
            .eq("paziente_id", pazienteId),
          supabase
            .from("pazienti")
            .select("peso_kg, altezza_cm")
            .eq("id", pazienteId)
            .maybeSingle(),
        ]);
        const m: string[] = [];
        if ((pazRes.data?.peso_kg as number | null) == null) m.push("peso");
        if ((pazRes.data?.altezza_cm as number | null) == null) m.push("altezza");
        if ((count ?? 0) === 0) m.push("misurazione baseline");
        if (!cancelled) {
          setHaCriolipolisi(true);
          setMissing(m);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pazienteId, tick]);

  return {
    loading,
    haCriolipolisi,
    missing,
    showAlert: haCriolipolisi && missing.length > 0,
    reload: () => setTick((t) => t + 1),
  };
}
