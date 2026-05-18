import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/logger";

interface PazienteRow {
  id: string;
  nome: string;
  cognome: string;
  created_at: string;
}
interface SedutaRow {
  id: string;
  numero_seduta: number;
  data_seduta: string;
  paziente_id: string;
  pazienti: { nome: string; cognome: string } | null;
}

export function AttivitaRecente() {
  const navigate = useNavigate();
  const [pazienti, setPazienti] = useState<PazienteRow[] | null>(null);
  const [sedute, setSedute] = useState<SedutaRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase
        .from("pazienti")
        .select("id, nome, cognome, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("seduta")
        .select("id, numero_seduta, data_seduta, paziente_id, pazienti:paziente_id(nome, cognome)")
        .eq("completata", true)
        .not("data_seduta", "is", null)
        .order("data_seduta", { ascending: false })
        .limit(5),
    ])
      .then(([pz, sd]) => {
        if (cancelled) return;
        setPazienti((pz.data ?? []) as PazienteRow[]);
        setSedute((sd.data ?? []) as any);
      })
      .catch((err) => {
        logger.error("[attivitaRecente]", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ultimi pazienti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {pazienti === null && <p className="text-xs text-muted-foreground">Caricamento…</p>}
          {pazienti && pazienti.length === 0 && (
            <p className="text-sm text-muted-foreground">Nessun paziente registrato.</p>
          )}
          {pazienti?.map((p) => (
            <div
              key={p.id}
              className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
              onClick={() => void navigate({ to: "/pazienti/$id", params: { id: p.id } })}
            >
              <span className="truncate">
                {p.cognome} {p.nome}
              </span>
              <span className="text-xs text-muted-foreground">{fmtData(p.created_at)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ultime sedute</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {sedute === null && <p className="text-xs text-muted-foreground">Caricamento…</p>}
          {sedute && sedute.length === 0 && (
            <p className="text-sm text-muted-foreground">Nessuna seduta completata.</p>
          )}
          {sedute?.map((s) => (
            <div
              key={s.id}
              className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
              onClick={() => void navigate({ to: "/pazienti/$id", params: { id: s.paziente_id } })}
            >
              <span className="truncate">
                {s.pazienti ? `${s.pazienti.cognome} ${s.pazienti.nome}` : "Paziente"} · #
                {s.numero_seduta}
              </span>
              <span className="text-xs text-muted-foreground">{fmtData(s.data_seduta)}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function fmtData(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}
