import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/impostazioni/backup")({
  component: BackupPage,
});

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => escapeCsv(r[c])).join(",")).join("\n");
  return `${head}\n${body}`;
}

function download(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function BackupPage() {
  const { hasRole } = useAuth();
  const [busy, setBusy] = React.useState<string | null>(null);

  const exportTable = async (
    label: string,
    table: "pazienti" | "seduta" | "consenso_firmato" | "magazzino_movimento",
    select: string,
  ) => {
    setBusy(label);
    try {
      const { data, error } = await supabase.from(table).select(select).limit(10000);
      if (error) throw error;
      const csv = toCsv((data ?? []) as unknown as Record<string, unknown>[]);
      if (!csv) {
        toast.info("Nessun dato da esportare");
        return;
      }
      const ts = new Date().toISOString().slice(0, 10);
      download(`${label}-${ts}.csv`, csv);
      toast.success(`Esportato ${label}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!hasRole("medico")) {
    return <p className="text-sm text-muted-foreground">Sezione riservata ai medici.</p>;
  }

  const items: Array<{
    label: string;
    desc: string;
    table: "pazienti" | "seduta" | "consenso_firmato" | "magazzino_movimento";
    select: string;
  }> = [
    {
      label: "pazienti",
      desc: "Anagrafica completa",
      table: "pazienti",
      select:
        "id,nome,cognome,codice_fiscale,data_nascita,sesso,telefono,email,indirizzo,citta,cap,provincia,created_at",
    },
    {
      label: "sedute",
      desc: "Storico sedute con esito e date",
      table: "seduta",
      select:
        "id,paziente_id,trattamento_id,numero_seduta,data_seduta,data_esecuzione_effettiva,durata_minuti,completata,note_cliniche,created_at",
    },
    {
      label: "consensi-firmati",
      desc: "Consensi firmati con snapshot e validità",
      table: "consenso_firmato",
      select:
        "id,paziente_id,template_id,titolo_snapshot,versione_snapshot,categoria_snapshot,firmato_il,valido_fino_a,rifiutato,revocato_il",
    },
    {
      label: "movimenti-magazzino",
      desc: "Carichi, scarichi e rettifiche",
      table: "magazzino_movimento",
      select:
        "id,prodotto_id,lotto_id,tipo,quantita,costo_unitario,seduta_id,paziente_id,operatore_id,data_movimento,note",
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export CSV</CardTitle>
          <CardDescription>
            Scarica i dati delle tabelle principali in formato CSV. I file restano sul tuo dispositivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it) => (
            <div
              key={it.label}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
            >
              <div>
                <p className="font-medium capitalize">{it.label.replace(/-/g, " ")}</p>
                <p className="text-xs text-muted-foreground">{it.desc}</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => void exportTable(it.label, it.table, it.select)}
                disabled={busy === it.label}
              >
                <Download className="mr-2 h-4 w-4" />
                {busy === it.label ? "Esportazione…" : "Scarica CSV"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export cartella paziente (PDF)</CardTitle>
          <CardDescription>
            Disponibile direttamente dalla scheda di ogni paziente, sezione documenti.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Apri un paziente e usa il pulsante di esportazione per generare la cartella in PDF
            (anagrafica, anamnesi, sedute, consensi).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
