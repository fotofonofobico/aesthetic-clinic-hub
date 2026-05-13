import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Ruler, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  MisurazioneDialog,
  MISURAZIONE_FIELDS,
  type MisurazioneRow,
} from "./misurazione-dialog";
import { useAuth as _useAuth } from "@/lib/auth-context";

function fmtData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT");
}

function fmtNum(n: number | null | undefined, suffix = ""): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n}${suffix}`;
}

function delta(a: number | null | undefined, b: number | null | undefined): string {
  if (a == null || b == null) return "";
  const d = Math.round((b - a) * 10) / 10;
  if (d === 0) return "±0";
  return d > 0 ? `+${d}` : `${d}`;
}

export function MisurazioniPanel({ pazienteId }: { pazienteId: string }) {
  const { hasRole } = useAuth();
  const [rows, setRows] = useState<MisurazioneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("paziente_misurazione")
      .select("*")
      .eq("paziente_id", pazienteId)
      .order("data_rilevazione", { ascending: false });
    if (!error) setRows((data ?? []) as MisurazioneRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [pazienteId]);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.data_rilevazione < b.data_rilevazione ? 1 : -1,
      ),
    [rows],
  );
  const ultima = sorted[0];
  const prima = sorted[sorted.length - 1];
  const haConfronto = sorted.length >= 2 && prima && ultima && prima.id !== ultima.id;

  const visibili = showAll ? sorted : sorted.slice(0, 5);

  async function elimina(id: string) {
    if (!hasRole("medico")) return;
    if (!confirm("Eliminare questa rilevazione?")) return;
    const { error } = await supabase.from("paziente_misurazione").delete().eq("id", id);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    toast.success("Rilevazione eliminata");
    void load();
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Ruler className="h-4 w-4" />
          Misurazioni
        </CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuova rilevazione
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessuna rilevazione registrata. Utile come baseline per trattamenti corpo
            (es. criolipolisi).
          </p>
        ) : (
          <>
            {haConfronto && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Variazione totale ({fmtData(prima!.data_rilevazione)} →{" "}
                  {fmtData(ultima!.data_rilevazione)})
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {prima!.peso_kg != null && ultima!.peso_kg != null && (
                    <span>
                      Peso:{" "}
                      <strong>{delta(prima!.peso_kg, ultima!.peso_kg)} kg</strong>
                    </span>
                  )}
                  {MISURAZIONE_FIELDS.map((f) => {
                    const a = prima!.misure?.[f.key as string];
                    const b = ultima!.misure?.[f.key as string];
                    if (a == null || b == null) return null;
                    return (
                      <span key={f.key as string}>
                        {f.label}: <strong>{delta(a, b)} cm</strong>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {visibili.map((r) => (
                <div
                  key={r.id}
                  className="rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium">{fmtData(r.data_rilevazione)}</div>
                    {hasRole("medico") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-destructive"
                        onClick={() => void elimina(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    {r.peso_kg != null && (
                      <span>
                        Peso: <strong className="text-foreground">{fmtNum(r.peso_kg, " kg")}</strong>
                      </span>
                    )}
                    {MISURAZIONE_FIELDS.map((f) => {
                      const v = r.misure?.[f.key as string];
                      if (v == null) return null;
                      return (
                        <span key={f.key as string}>
                          {f.label}:{" "}
                          <strong className="text-foreground">{fmtNum(v, " cm")}</strong>
                        </span>
                      );
                    })}
                  </div>
                  {r.note && (
                    <div className="mt-1 text-xs italic text-muted-foreground">{r.note}</div>
                  )}
                </div>
              ))}
            </div>

            {sorted.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll((v) => !v)}
                className="w-full"
              >
                {showAll ? "Mostra meno" : `Mostra tutte (${sorted.length})`}
              </Button>
            )}
          </>
        )}
      </CardContent>

      <MisurazioneDialog
        open={open}
        onOpenChange={setOpen}
        pazienteId={pazienteId}
        onSaved={() => void load()}
      />
    </Card>
  );
}
