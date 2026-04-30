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
      const ora = new Date();
      const tra30 = new Date(); tra30.setDate(tra30.getDate() + 30);
      const limite12mesi = new Date(); limite12mesi.setFullYear(limite12mesi.getFullYear() - 1);

      // 1) Anamnesi vecchie / mancanti
      try {
        const { data: pazienti } = await supabase
          .from("pazienti")
          .select("id, anamnesi(id, updated_at)")
          .is("deleted_at", null)
          .limit(1000);
        const incomplete = (pazienti ?? []).filter((p: any) => {
          const an = p.anamnesi?.[0];
          if (!an) return true;
          return an.updated_at && new Date(an.updated_at) < limite12mesi;
        }).length;
        if (incomplete > 0) {
          out.push({ key: "anamnesi", label: "Anamnesi mancanti o > 12 mesi", count: incomplete, severity: "warning", to: "/pazienti" });
        }
      } catch {}

      // 2) Lotti scaduti / in scadenza
      try {
        const { data: lotti } = await supabase
          .from("prodotto_lotto")
          .select("id, quantita_disponibile, data_scadenza, prodotto:prodotto_id(soglia_minima, modalita_tracking)")
          .gt("quantita_disponibile", 0);
        let basse = 0, scaduti = 0, inScadenza = 0;
        (lotti ?? []).forEach((l: any) => {
          if (l.prodotto?.modalita_tracking !== "tracciato") return;
          const soglia = l.prodotto?.soglia_minima ?? 0;
          if (l.data_scadenza) {
            const d = new Date(l.data_scadenza);
            if (d < ora) scaduti++;
            else if (d < tra30) inScadenza++;
          }
          if (soglia && l.quantita_disponibile <= soglia) basse++;
        });
        if (scaduti > 0) out.push({ key: "scaduti", label: "Lotti scaduti", count: scaduti, severity: "critical", to: "/magazzino" });
        if (inScadenza > 0) out.push({ key: "scadenza", label: "Lotti in scadenza < 30gg", count: inScadenza, severity: "warning", to: "/magazzino" });
        if (basse > 0) out.push({ key: "scorte", label: "Scorte sotto soglia", count: basse, severity: "warning", to: "/magazzino" });
      } catch {}

      // 3) Consensi obsoleti / in scadenza
      try {
        const { data: cf } = await supabase
          .from("consenso_firmato")
          .select("id, versione_snapshot, valido_fino_a, revocato_il, rifiutato, template_id, template:template_id(versione, attivo)")
          .is("revocato_il", null)
          .eq("rifiutato", false)
          .limit(1000);
        let obsoleti = 0, inScad = 0;
        (cf ?? []).forEach((c: any) => {
          const tpl = c.template;
          if (tpl && tpl.attivo && tpl.versione !== c.versione_snapshot) obsoleti++;
          if (c.valido_fino_a) {
            const d = new Date(c.valido_fino_a);
            if (d > ora && d < tra30) inScad++;
          }
        });
        if (obsoleti > 0) out.push({ key: "obsoleti", label: "Consensi con versione obsoleta", count: obsoleti, severity: "warning", to: "/consensi" });
        if (inScad > 0) out.push({ key: "cscad", label: "Consensi in scadenza < 30gg", count: inScad, severity: "warning", to: "/consensi" });
      } catch {}

      // 4) Consensi mancanti per sedute prossime
      try {
        const tra7 = new Date(); tra7.setDate(tra7.getDate() + 7);
        const { data: sedute } = await supabase
          .from("seduta")
          .select("id, paziente_id, data_seduta")
          .gte("data_seduta", ora.toISOString())
          .lte("data_seduta", tra7.toISOString())
          .eq("completata", false);
        const pIds = Array.from(new Set((sedute ?? []).map((s: any) => s.paziente_id).filter(Boolean)));
        if (pIds.length > 0) {
          const { data: consensi } = await supabase
            .from("consenso_firmato")
            .select("paziente_id")
            .in("paziente_id", pIds);
          const conConsenso = new Set((consensi ?? []).map((c: any) => c.paziente_id));
          const mancanti = pIds.filter((id) => !conConsenso.has(id)).length;
          if (mancanti > 0) {
            out.push({ key: "consensi", label: "Consensi mancanti (sedute < 7gg)", count: mancanti, severity: "critical", to: "/consensi" });
          }
        }
      } catch {}

      if (!cancelled) setItems(out);
    })();
    return () => { cancelled = true; };
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
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-success">
              <span className="inline-block h-2 w-2 rounded-full bg-success" />
              Tutto in regola
            </div>
            <p className="text-[10px] leading-snug text-muted-foreground">
              Nessuna anamnesi vecchia, nessun lotto scaduto/in scadenza, nessuno scorte basse,
              nessun consenso obsoleto/in scadenza, nessun consenso mancante per sedute imminenti.
            </p>
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
