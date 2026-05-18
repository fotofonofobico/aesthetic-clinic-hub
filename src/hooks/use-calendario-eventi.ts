import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  CalendarioVistaEvento,
  EventoCalendario,
} from "@/types/calendario";
import { COLORE_SCADENZA, COLORE_SEDUTA, TIPO_COLORE } from "@/lib/calendario";
import { logger } from "@/lib/logger";

export interface FiltriCalendario {
  mostraSedute: boolean;
  mostraEventi: boolean;
  mostraScadenze: boolean;
  paziente_id?: string | null;
}

interface Params {
  from: Date;
  to: Date;
  filtri: FiltriCalendario;
}

interface PazienteMin {
  id: string;
  nome: string;
  cognome: string;
}

export function useCalendarioEventi({ from, to, filtri }: Params) {
  const [eventi, setEventi] = useState<CalendarioVistaEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    const run = async (): Promise<{ data: any[] | null }> => ({ data: [] });

    const sedutePromise: Promise<{ data: any[] | null }> = (async () => {
      if (!filtri.mostraSedute) return { data: [] };
      let q = supabase
        .from("seduta")
        .select("id, paziente_id, piano_id, numero_seduta, data_seduta, durata_minuti, completata, trattamento_id")
        .gte("data_seduta", fromIso)
        .lte("data_seduta", toIso)
        .not("data_seduta", "is", null);
      if (filtri.paziente_id) q = q.eq("paziente_id", filtri.paziente_id);
      const r = await q;
      return { data: (r.data as any[]) ?? [] };
    })();

    const eventiPromise: Promise<{ data: any[] | null }> = (async () => {
      if (!filtri.mostraEventi) return { data: [] };
      let q = supabase
        .from("evento_calendario")
        .select("*")
        .gte("data_inizio", fromIso)
        .lte("data_inizio", toIso);
      if (filtri.paziente_id) q = q.eq("paziente_id", filtri.paziente_id);
      const r = await q;
      return { data: (r.data as any[]) ?? [] };
    })();

    const scadenzePromise: Promise<{ data: any[] | null }> = (async () => {
      if (!filtri.mostraScadenze || filtri.paziente_id) return { data: [] };
      const fromDate = from.toISOString().slice(0, 10);
      const toDate = to.toISOString().slice(0, 10);
      const r = await supabase
        .from("prodotto_lotto")
        .select("id, prodotto_id, numero_lotto, data_scadenza, quantita_disponibile, prodotto:prodotto_id(nome)")
        .gte("data_scadenza", fromDate)
        .lte("data_scadenza", toDate)
        .gt("quantita_disponibile", 0);
      return { data: (r.data as any[]) ?? [] };
    })();

    void run;
    const queries: Promise<{ data: any[] | null }>[] = [sedutePromise, eventiPromise, scadenzePromise];

    // allSettled: un canale rotto non azzera la vista. Per i rejected usiamo
    // fallback [] (la UI già tollera sezioni vuote).
    Promise.allSettled(queries)
      .then(async (results) => {
        if (cancelled) return;

        const [sedRes, evRes, scadRes] = results;
        const sedute =
          sedRes.status === "fulfilled" ? ((sedRes.value?.data ?? []) as any[]) : [];
        const eventiCal =
          evRes.status === "fulfilled"
            ? ((evRes.value?.data ?? []) as EventoCalendario[])
            : [];
        const scadenze =
          scadRes.status === "fulfilled" ? ((scadRes.value?.data ?? []) as any[]) : [];

        if (sedRes.status === "rejected") logger.error("[calendario] sedute", sedRes.reason);
        if (evRes.status === "rejected") logger.error("[calendario] eventi", evRes.reason);
        if (scadRes.status === "rejected") logger.error("[calendario] scadenze", scadRes.reason);

        // Carica nomi pazienti in batch
        const pazienteIds = new Set<string>();
        sedute.forEach((s) => s.paziente_id && pazienteIds.add(s.paziente_id));
        eventiCal.forEach((e) => e.paziente_id && pazienteIds.add(e.paziente_id));

        let pazientiMap = new Map<string, PazienteMin>();
        if (pazienteIds.size > 0) {
          const { data: pz } = await supabase
            .from("pazienti")
            .select("id, nome, cognome")
            .in("id", Array.from(pazienteIds));
          (pz ?? []).forEach((p) => pazientiMap.set(p.id, p as PazienteMin));
        }

        const out: CalendarioVistaEvento[] = [];

        for (const s of sedute) {
          const pz = s.paziente_id ? pazientiMap.get(s.paziente_id) : null;
          out.push({
            id: `seduta:${s.id}`,
            source: "seduta",
            titolo: pz ? `${pz.cognome} ${pz.nome}` : "Seduta",
            sottotitolo: `Seduta #${s.numero_seduta}${s.completata ? " ✓" : ""}`,
            start: new Date(s.data_seduta),
            end: s.durata_minuti
              ? new Date(new Date(s.data_seduta).getTime() + s.durata_minuti * 60_000)
              : undefined,
            tutto_il_giorno: false,
            colore: COLORE_SEDUTA,
            paziente_id: s.paziente_id,
            paziente_nome: pz ? `${pz.cognome} ${pz.nome}` : null,
            raw: s,
          });
        }

        for (const e of eventiCal) {
          const pz = e.paziente_id ? pazientiMap.get(e.paziente_id) : null;
          out.push({
            id: `evento:${e.id}`,
            source: "evento",
            titolo: e.titolo,
            sottotitolo: pz ? `${pz.cognome} ${pz.nome}` : undefined,
            start: new Date(e.data_inizio),
            end: e.data_fine ? new Date(e.data_fine) : undefined,
            tutto_il_giorno: e.tutto_il_giorno,
            colore: e.colore || TIPO_COLORE[e.tipo],
            paziente_id: e.paziente_id,
            paziente_nome: pz ? `${pz.cognome} ${pz.nome}` : null,
            raw: e,
          });
        }

        for (const l of scadenze) {
          out.push({
            id: `scad:${l.id}`,
            source: "scadenza_lotto",
            titolo: `Scade: ${l.prodotto?.nome ?? "prodotto"}`,
            sottotitolo: `Lotto ${l.numero_lotto}`,
            start: new Date(l.data_scadenza + "T09:00:00"),
            tutto_il_giorno: true,
            colore: COLORE_SCADENZA,
            raw: l,
          });
        }

        setEventi(out);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error("[calendario] errore caricamento", err);
        setError(err.message || "Errore di caricamento");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from.getTime(), to.getTime(), filtri.mostraSedute, filtri.mostraEventi, filtri.mostraScadenze, filtri.paziente_id, reloadKey]);

  return { eventi, loading, error, reload };
}
