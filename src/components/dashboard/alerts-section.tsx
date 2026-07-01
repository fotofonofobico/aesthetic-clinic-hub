import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDashboardAlerts, type AlertItem } from "@/hooks/use-dashboard-alerts";

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

interface ConsensoRawRow {
  id: string;
  paziente_id: string;
  versione_snapshot: string;
  firmato_il: string;
  titolo_snapshot: string | null;
  template_id: string | null;
  template: {
    versione: string;
    attivo: boolean;
    titolo: string | null;
    richiede_rifirma_su_nuova_versione: boolean | null;
    motivo_nuova_versione: string | null;
  } | null;
  paziente: { nome: string | null; cognome: string | null } | null;
}

export function AlertsSection() {
  const { data: items, isLoading, isFetching, refetch } = useDashboardAlerts();
  const [openObsoleti, setOpenObsoleti] = useState(false);

  function renderItem(a: AlertItem & { detail?: "consensi_obsoleti" }) {
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
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Alert
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-label="Ricarica alert"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Caricamento…</p>
          ) : !items || items.length === 0 ? (
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
          {items && items.length > 0 && (
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
      ((data ?? []) as unknown as ConsensoRawRow[]).forEach((c) => {
        const tpl = c.template;
        if (!tpl || !tpl.attivo) return;
        if (tpl.versione === c.versione_snapshot) return;
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
