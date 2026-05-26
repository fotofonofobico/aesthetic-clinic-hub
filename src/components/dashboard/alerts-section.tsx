import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface AlertItem {
  key: string;
  label: string;
  count: number;
  severity: "warning" | "critical";
  to: string;
  detail?: "consensi_obsoleti";
}

interface ConsensoObsoletoRow {
  id: string;
  paziente_id: string;
  paziente_nome: string;
  template_titolo: string;
  versione_firmata: string;
  versione_attuale: string;
  firmato_il: string;
  motivo_nuova_versione: string | null;
}


export function AlertsSection() {
  const [items, setItems] = useState<AlertItem[] | null>(null);
  const [openObsoleti, setOpenObsoleti] = useState(false);

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

      // 3) Consensi: solo IN SCADENZA reale.
      // Nota: le firme dei consensi NON sono retroattive: una nuova versione
      // del template non invalida quanto già firmato. Quindi nessun alert
      // "consensi da rifirmare".
      try {
        const { data: cf } = await supabase
          .from("consenso_firmato")
          .select(
            "id, valido_fino_a, revocato_il, rifiutato, sedute_max_snapshot, sedute_consumate, durata_tipo_snapshot",
          )
          .is("revocato_il", null)
          .eq("rifiutato", false)
          .limit(1000);
        let inScad = 0;
        (cf ?? []).forEach((c: any) => {
          if (c.valido_fino_a) {
            const d = new Date(c.valido_fino_a);
            if (d > ora && d < tra30) inScad++;
          }
          if (
            c.durata_tipo_snapshot === "sedute" &&
            typeof c.sedute_max_snapshot === "number" &&
            typeof c.sedute_consumate === "number" &&
            c.sedute_max_snapshot - c.sedute_consumate === 1
          ) {
            inScad++;
          }
        });
        if (inScad > 0) out.push({ key: "cscad", label: "Consensi in scadenza", count: inScad, severity: "warning", to: "/consensi" });
      } catch {}

      // 4) Consensi mancanti per sedute prossime — match per trattamento
      try {
        const tra7 = new Date(); tra7.setDate(tra7.getDate() + 7);
        const { data: sedute } = await supabase
          .from("seduta")
          .select("id, paziente_id, trattamento_id, data_seduta")
          .gte("data_seduta", ora.toISOString())
          .lte("data_seduta", tra7.toISOString())
          .eq("completata", false)
          .limit(1000);
        const sedRows = (sedute ?? []) as Array<{
          id: string;
          paziente_id: string;
          trattamento_id: string | null;
        }>;
        // Mappa trattamento_id -> consenso_template_id
        const trattIds = Array.from(
          new Set(sedRows.map((s) => s.trattamento_id).filter(Boolean) as string[]),
        );
        const trattToTpl = new Map<string, string | null>();
        if (trattIds.length > 0) {
          const { data: tratts } = await supabase
            .from("trattamenti")
            .select("id, consenso_template_id")
            .in("id", trattIds);
          (tratts ?? []).forEach((t: any) =>
            trattToTpl.set(t.id, t.consenso_template_id ?? null),
          );
        }
        // Pre-carica tutti i consensi attivi dei pazienti coinvolti
        const pIds = Array.from(new Set(sedRows.map((s) => s.paziente_id).filter(Boolean)));
        const consensiByPz = new Map<string, Set<string>>(); // paziente -> set di template_id validi
        if (pIds.length > 0) {
          const { data: cons } = await supabase
            .from("consenso_firmato")
            .select(
              "paziente_id, template_id, valido_fino_a, revocato_il, rifiutato, sedute_max_snapshot, sedute_consumate, durata_tipo_snapshot",
            )
            .in("paziente_id", pIds)
            .is("revocato_il", null)
            .eq("rifiutato", false);
          (cons ?? []).forEach((c: any) => {
            if (!c.template_id) return;
            // valido se non scaduto e non esaurito
            if (c.valido_fino_a && new Date(c.valido_fino_a) <= ora) return;
            if (
              c.durata_tipo_snapshot === "sedute" &&
              typeof c.sedute_max_snapshot === "number" &&
              typeof c.sedute_consumate === "number" &&
              c.sedute_consumate >= c.sedute_max_snapshot
            ) {
              return;
            }
            const s = consensiByPz.get(c.paziente_id) ?? new Set<string>();
            s.add(c.template_id);
            consensiByPz.set(c.paziente_id, s);
          });
        }
        // Conta sedute con consenso pertinente mancante
        const pazientiMancanti = new Set<string>();
        sedRows.forEach((s) => {
          if (!s.trattamento_id) return;
          const tplId = trattToTpl.get(s.trattamento_id);
          if (!tplId) return; // trattamento senza consenso richiesto → ignora
          const valid = consensiByPz.get(s.paziente_id);
          if (!valid || !valid.has(tplId)) pazientiMancanti.add(s.paziente_id);
        });
        if (pazientiMancanti.size > 0) {
          out.push({ key: "consensi", label: "Consenso specifico mancante (sedute < 7gg)", count: pazientiMancanti.size, severity: "critical", to: "/consensi" });
        }
      } catch {}


      if (!cancelled) setItems(out);
    })();
    return () => { cancelled = true; };
  }, []);

  function renderItem(a: AlertItem) {
    const content = (
      <>
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
      </>
    );

    if (a.detail === "consensi_obsoleti") {
      return (
        <button
          key={a.key}
          type="button"
          onClick={() => setOpenObsoleti(true)}
          className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/50"
        >
          {content}
        </button>
      );
    }

    return (
      <Link
        key={a.key}
        to={a.to}
        className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
      >
        {content}
      </Link>
    );
  }

  return (
    <>
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
            items.map(renderItem)
          )}
          {items !== null && items.length > 0 && (
            <div className="pt-1 text-[10px] text-muted-foreground">
              <CheckCircle2 className="mr-1 inline h-3 w-3" />
              Click per aprire la sezione
            </div>
          )}
        </CardContent>
      </Card>

      <ConsensiObsoletiDialog open={openObsoleti} onOpenChange={setOpenObsoleti} />
    </>
  );
}

function ConsensiObsoletiDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [rows, setRows] = useState<ConsensoObsoletoRow[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setRows(null);
    void (async () => {
      const { data } = await supabase
        .from("consenso_firmato")
        .select(
          "id, paziente_id, versione_snapshot, firmato_il, titolo_snapshot, template_id, template:template_id(versione, attivo, titolo, richiede_rifirma_su_nuova_versione, motivo_nuova_versione), paziente:paziente_id(nome, cognome)"
        )
        .is("revocato_il", null)
        .eq("rifiutato", false)
        .order("firmato_il", { ascending: false })
        .limit(500);

      const out: ConsensoObsoletoRow[] = [];
      (data ?? []).forEach((c: any) => {
        const tpl = c.template;
        if (!tpl || !tpl.attivo) return;
        if (tpl.versione === c.versione_snapshot) return;
        // Solo se il template richiede esplicitamente la rifirma su nuova versione
        if (tpl.richiede_rifirma_su_nuova_versione !== true) return;
        out.push({
          id: c.id,
          paziente_id: c.paziente_id,
          paziente_nome: c.paziente
            ? `${c.paziente.cognome ?? ""} ${c.paziente.nome ?? ""}`.trim() || "—"
            : "—",
          template_titolo: tpl.titolo ?? c.titolo_snapshot ?? "—",
          versione_firmata: c.versione_snapshot,
          versione_attuale: tpl.versione,
          firmato_il: c.firmato_il,
          motivo_nuova_versione: tpl.motivo_nuova_versione ?? null,
        });
      });

      if (!cancelled) setRows(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Consensi da rifirmare</DialogTitle>
          <DialogDescription>
            Il modello è stato aggiornato in modo sostanziale e richiede una nuova firma.
            Apri la scheda paziente per procedere.
          </DialogDescription>
        </DialogHeader>

        {rows === null ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Caricamento…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nessun consenso obsoleto.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Paziente</th>
                  <th className="px-3 py-2 text-left">Consenso</th>
                  <th className="px-3 py-2 text-left">Versione</th>
                  <th className="px-3 py-2 text-right">Azione</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-3 py-2">{r.paziente_nome}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <div>{r.template_titolo}</div>
                      {r.motivo_nuova_versione && (
                        <div className="mt-0.5 text-[11px] italic">
                          {r.motivo_nuova_versione}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-warning/15 px-1.5 py-0.5 text-xs">
                        v{r.versione_firmata} → v{r.versione_attuale}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        to="/pazienti/$id"
                        params={{ id: r.paziente_id }}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        onClick={() => onOpenChange(false)}
                      >
                        Apri scheda <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}

              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
