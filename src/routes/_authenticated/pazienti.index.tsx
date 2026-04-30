import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, AlertTriangle, ShieldAlert, Info, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import type { Paziente, AlertSeverity } from "@/types/clinico";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/pazienti/")({
  component: PazientiListPage,
});

interface PazienteRow extends Paziente {
  max_severity: AlertSeverity | null;
}

function PazientiListPage() {
  const { hasRole } = useAuth();
  const isMedico = hasRole("medico");
  const [pazienti, setPazienti] = useState<PazienteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [mostraArchiviati, setMostraArchiviati] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    const { data: pData, error } = await supabase
      .from("pazienti")
      .select("*")
      .filter("deleted_at", mostraArchiviati ? "not.is" : "is", null)
      .order("cognome", { ascending: true });

    if (error) {
      toast.error("Errore caricamento pazienti");
      setLoading(false);
      return;
    }

    // Carica i flag rischio per evidenziare il livello max
    const ids = (pData ?? []).map((p) => p.id);
    let flagsByPaziente: Record<string, AlertSeverity[]> = {};
    if (ids.length > 0) {
      const { data: flags } = await supabase
        .from("anamnesi_flag_rischio")
        .select("paziente_id, severity")
        .in("paziente_id", ids);
      flagsByPaziente = (flags ?? []).reduce<Record<string, AlertSeverity[]>>((acc, f) => {
        (acc[f.paziente_id] ??= []).push(f.severity as AlertSeverity);
        return acc;
      }, {});
    }

    const order: Record<AlertSeverity, number> = { critico: 3, attenzione: 2, info: 1 };
    const enriched: PazienteRow[] = (pData ?? []).map((p) => {
      const sev = flagsByPaziente[p.id] ?? [];
      const max = sev.sort((a, b) => order[b] - order[a])[0] ?? null;
      return { ...(p as Paziente), max_severity: max };
    });

    setPazienti(enriched);
    setLoading(false);
  }, [mostraArchiviati]);

  useEffect(() => {
    void load();
  }, [load]);

  async function ripristinaPaziente(id: string) {
    if (!isMedico) {
      toast.error("Solo i medici possono ripristinare pazienti");
      return;
    }
    const { error } = await supabase
      .from("pazienti")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", id);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    toast.success("Paziente ripristinato");
    void load();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pazienti;
    return pazienti.filter((p) => {
      return (
        p.cognome.toLowerCase().includes(q) ||
        p.nome.toLowerCase().includes(q) ||
        (p.codice_fiscale ?? "").toLowerCase().includes(q) ||
        (p.telefono ?? "").includes(q) ||
        (p.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [pazienti, query]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Pazienti</h1>
          <p className="text-sm text-muted-foreground">
            {pazienti.length} {pazienti.length === 1 ? "paziente" : "pazienti"} in archivio
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/pazienti/$id/edit", params: { id: "new" } })}>
          <Plus className="h-4 w-4" />
          Nuovo paziente
        </Button>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-[260px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca per cognome, nome, CF, telefono…"
            className="pl-9"
          />
        </div>
        <Button
          variant={mostraArchiviati ? "default" : "outline"}
          size="sm"
          onClick={() => setMostraArchiviati((v) => !v)}
        >
          {mostraArchiviati ? "Mostra attivi" : "Mostra archiviati"}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground">
              {pazienti.length === 0
                ? mostraArchiviati
                  ? "Nessun paziente archiviato."
                  : "Nessun paziente in archivio. Crea il primo con il pulsante in alto."
                : "Nessun risultato per la ricerca."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Paziente</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Contatti</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">CF</th>
                {mostraArchiviati && <th className="px-4 py-3 text-right font-medium">Azioni</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-accent/40"
                  onClick={() =>
                    !mostraArchiviati && navigate({ to: "/pazienti/$id", params: { id: p.id } })
                  }
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {p.cognome} {p.nome}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.data_nascita ? formatDate(p.data_nascita) : "—"}
                      {p.sesso ? ` · ${p.sesso}` : ""}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {p.telefono ?? "—"}
                    {p.email ? <div className="text-xs">{p.email}</div> : null}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground lg:table-cell">
                    {p.codice_fiscale ?? "—"}
                  </td>
                  {mostraArchiviati && (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {isMedico && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void ripristinaPaziente(p.id)}
                        >
                          <ArchiveRestore className="h-4 w-4" />
                          Ripristina
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SeverityBadge({ severity }: { severity: AlertSeverity | null }) {
  if (!severity) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const cfg = {
    critico: {
      icon: <ShieldAlert className="h-3 w-3" />,
      label: "Critico",
      cls: "bg-destructive/15 text-destructive border-destructive/30",
    },
    attenzione: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: "Attenzione",
      cls: "bg-warning/15 text-warning-foreground border-warning/40",
    },
    info: {
      icon: <Info className="h-3 w-3" />,
      label: "Info",
      cls: "bg-accent text-accent-foreground border-accent",
    },
  }[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        cfg.cls,
      )}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("it-IT");
}

export { Link };
