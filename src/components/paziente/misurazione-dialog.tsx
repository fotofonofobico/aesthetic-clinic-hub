import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export interface MisureCircon {
  vita?: number | null;
  fianchi?: number | null;
  addome?: number | null;
  braccio_dx?: number | null;
  braccio_sn?: number | null;
  coscia_dx?: number | null;
  coscia_sn?: number | null;
  [key: string]: number | null | undefined;
}

const FIELDS: { key: keyof MisureCircon; label: string }[] = [
  { key: "vita", label: "Vita" },
  { key: "fianchi", label: "Fianchi" },
  { key: "addome", label: "Addome" },
  { key: "braccio_dx", label: "Braccio dx" },
  { key: "braccio_sn", label: "Braccio sn" },
  { key: "coscia_dx", label: "Coscia dx" },
  { key: "coscia_sn", label: "Coscia sn" },
];

export function MisurazioneDialog({
  open,
  onOpenChange,
  pazienteId,
  sedutaId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pazienteId: string;
  sedutaId?: string | null;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [peso, setPeso] = useState("");
  const [altezza, setAltezza] = useState("");
  const [misure, setMisure] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Precompila altezza con l'ultima nota a DB (è un parametro stabile)
  useEffect(() => {
    if (!open) return;
    setData(new Date().toISOString().slice(0, 10));
    setPeso("");
    setAltezza("");
    setMisure({});
    setNote("");
    void supabase
      .from("paziente_misurazione")
      .select("altezza_cm")
      .eq("paziente_id", pazienteId)
      .not("altezza_cm", "is", null)
      .order("data_rilevazione", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data: row }) => {
        const a = (row?.altezza_cm as number | null) ?? null;
        if (a != null) setAltezza(String(a));
      });
  }, [open, pazienteId]);

  function setField(k: string, v: string) {
    setMisure((m) => ({ ...m, [k]: v }));
  }

  async function salva() {
    if (!user?.id) return;
    setSaving(true);
    const misureClean: MisureCircon = {};
    for (const f of FIELDS) {
      const raw = misure[f.key as string];
      if (raw && raw.trim()) {
        const n = Number(raw.replace(",", "."));
        if (!Number.isNaN(n)) misureClean[f.key] = n;
      }
    }
    const { error } = await supabase.from("paziente_misurazione").insert({
      paziente_id: pazienteId,
      seduta_id: sedutaId ?? null,
      data_rilevazione: data,
      peso_kg: peso.trim() ? Number(peso.replace(",", ".")) : null,
      misure: misureClean as never,
      note: note.trim() || null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    toast.success("Misurazione registrata");
    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuova rilevazione</DialogTitle>
          <DialogDescription>
            Inserisci solo i campi che ti servono. Tutto è opzionale tranne la data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Data *</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <Label>Peso (kg)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Circonferenze (cm)</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {FIELDS.map((f) => (
                <div key={f.key as string}>
                  <div className="text-[11px] text-muted-foreground">{f.label}</div>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={misure[f.key as string] ?? ""}
                    onChange={(e) => setField(f.key as string, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Note</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Opzionale"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={() => void salva()} disabled={saving}>
            {saving ? "Salvataggio…" : "Salva rilevazione"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface MisurazioneRow {
  id: string;
  paziente_id: string;
  seduta_id: string | null;
  data_rilevazione: string;
  peso_kg: number | null;
  misure: MisureCircon;
  note: string | null;
  created_at: string;
}

export const MISURAZIONE_FIELDS = FIELDS;
