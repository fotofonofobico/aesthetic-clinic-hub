import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertItem {
  key: string;
  label: string;
  count: number;
  severity: "warning" | "critical";
  to: string;
}

export function AlertsSection() {
  const [items, setItems] = useState<AlertItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const out: AlertItem[] = [];

      // Anamnesi incomplete: pazienti senza anamnesi o aggiornata >12 mesi
      try {
        const limite = new Date();
        limite.setFullYear(limite.getFullYear() - 1);
        const { data: pazienti } = await supabase
          .from("pazienti")
          .select("id, anamnesi(id, updated_at)")
          .is("deleted_at", null)
          .limit(1000);
        const incomplete = (pazienti ?? []).filter((p: any) => {
          const an = p.anamnesi?.[0];
          if (!an) return true;
          return an.updated_at && new Date(an.updated_at) < limite;
        }).length;
        if (incomplete > 0) {
          out.push({
            key: "anamnesi",
            label: "Anamnesi incomplete o vecchie",
            count: incomplete,
            severity: "warning",
            to: "/pazienti",
          });
        }
      } catch {
        // ignora
      }

      // Scorte basse: lotti con quantità sotto soglia
      try {
        const { data: lotti } = await supabase
          .from("prodotto_lotto")
          .select("id, quantita_disponibile, prodotto:prodotto_id(soglia_minima)")
          .gt("quantita_disponibile", 0);
        let basse = 0;
        let zero = 0;
        (lotti ?? []).forEach((l: any) => {
          const soglia = l.prodotto?.soglia_minima ?? 0;
          if (l.quantita_disponibile === 0) zero++;
          else if (soglia && l.quantita_disponibile < soglia) basse++;
        });
        if (basse > 0) {
          out.push({
            key: "scorte",
            label: "Scorte sotto soglia",
            count: basse,
            severity: "warning",
            to: "/magazzino",
          });
        }
        if (zero > 0) {
          out.push({
            key: "esaurito",
            label: "Prodotti esauriti",
            count: zero,
            severity: "critical",
            to: "/magazzino",
          });
        }
      } catch {
        // ignora
      }

      // Consensi mancanti: sedute pianificate prossimi 7gg senza consenso firmato per quel paziente
      try {
        const oggi = new Date();
        const tra7 = new Date();
        tra7.setDate(tra7.getDate() + 7);
        const { data: sedute } = await supabase
          .from("seduta")
          .select("id, paziente_id, data_seduta")
          .gte("data_seduta", oggi.toISOString())
          .lte("data_seduta", tra7.toISOString())
          .eq("completata", false);
        const pIds = Array.from(
          new Set((sedute ?? []).map((s: any) => s.paziente_id).filter(Boolean)),
        );
        if (pIds.length > 0) {
          const { data: consensi } = await supabase
            .from("consenso_firmato")
            .select("paziente_id")
            .in("paziente_id", pIds);
          const conConsenso = new Set((consensi ?? []).map((c: any) => c.paziente_id));
          const mancanti = pIds.filter((id) => !conConsenso.has(id)).length;
          if (mancanti > 0) {
            out.push({
              key: "consensi",
              label: "Consensi mancanti (sedute prossime)",
              count: mancanti,
              severity: "critical",
              to: "/consensi",
            });
          }
        }
      } catch {
        // ignora
      }

      if (!cancelled) setItems(out);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4" /> Alert
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items === null ? (
          <p className="text-xs text-muted-foreground">Caricamento…</p>
        ) : items.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-success">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            Tutto in regola
          </div>
        ) : (
          items.map((a) => (
            <Link
              key={a.key}
              to={a.to}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
            >
              <span className="flex items-center gap-2 truncate">
                <span
                  className={cn(
                    "inline-block h-2 w-2 shrink-0 rounded-full",
                    a.severity === "critical" ? "bg-destructive" : "bg-warning",
                  )}
                />
                <span className="truncate">{a.label}</span>
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
                {a.count}
              </span>
            </Link>
          ))
        )}
        {items !== null && items.length > 0 && (
          <div className="pt-1 text-[10px] text-muted-foreground">
            <CheckCircle2 className="mr-1 inline h-3 w-3" />
            Click per aprire la sezione
          </div>
        )}
      </CardContent>
    </Card>
  );
}
