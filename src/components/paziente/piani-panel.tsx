import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Syringe, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type {
  PianoTrattamento,
  Seduta,
  Trattamento,
  PianoStato,
} from "@/types/trattamenti";
import { puoEseguireTrattamento, evaluateAccess } from "@/lib/access-guard";

const STATO_LABELS: Record<PianoStato, string> = {
  attivo: "Attivo",
  completato: "Completato",
  sospeso: "Sospeso",
  annullato: "Annullato",
};

export function PianiPanel({ pazienteId }: { pazienteId: string }) {
  const { user } = useAuth();
  const [piani, setPiani] = useState<PianoTrattamento[]>([]);
  const [sedutePerPiano, setSedutePerPiano] = useState<Record<string, Seduta[]>>({});
  const [trattamenti, setTrattamenti] = useState<Trattamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // form nuovo piano
  const [titolo, setTitolo] = useState("");
  const [tratId, setTratId] = useState<string>("none");
  const [numSedute, setNumSedute] = useState("1");
  const [prezzo, setPrezzo] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, [pazienteId]);

  async function load() {
    setLoading(true);
    const [pRes, sRes, tRes] = await Promise.all([
      supabase
        .from("piano_trattamento")
        .select("*")
        .eq("paziente_id", pazienteId)
        .order("created_at", { ascending: false }),
      supabase
        .from("seduta")
        .select("*")
        .eq("paziente_id", pazienteId)
        .order("numero_seduta"),
      supabase.from("trattamenti").select("*").eq("attivo", true).order("nome"),
    ]);
    const lst = (pRes.data ?? []) as PianoTrattamento[];
    setPiani(lst);
    const map: Record<string, Seduta[]> = {};
    for (const s of (sRes.data ?? []) as Seduta[]) {
      (map[s.piano_id] ??= []).push(s);
    }
    setSedutePerPiano(map);
    setTrattamenti((tRes.data ?? []) as Trattamento[]);
    setLoading(false);
  }

  function resetForm() {
    setTitolo("");
    setTratId("none");
    setNumSedute("1");
    setPrezzo("");
    setNote("");
  }

  async function creaPiano() {
    if (!titolo.trim()) {
      toast.error("Il titolo è obbligatorio");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("piano_trattamento").insert({
      paziente_id: pazienteId,
      trattamento_id: tratId === "none" ? null : tratId,
      titolo: titolo.trim(),
      numero_sedute_previste: Math.max(1, Number(numSedute) || 1),
      prezzo_totale: prezzo ? Number(prezzo) : null,
      note: note.trim() || null,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Piano creato");
    setOpen(false);
    resetForm();
    void load();
  }

  async function aggiornaStato(p: PianoTrattamento, stato: PianoStato) {
    const { error } = await supabase
      .from("piano_trattamento")
      .update({ stato })
      .eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  }

  async function aggiungiSeduta(p: PianoTrattamento) {
    // Access guard centralizzato: GDPR + anamnesi firmata + consensi specifici
    if (p.trattamento_id) {
      const guard = await puoEseguireTrattamento(pazienteId, p.trattamento_id);
      if (!guard.ok) {
        toast.error(
          `Impossibile aggiungere seduta. ${guard.motivi.join(" · ")}`,
          { duration: 7000 },
        );
        return;
      }
    } else {
      // Senza trattamento: almeno verifica i blocchi globali (GDPR + anamnesi)
      const ev = await evaluateAccess(pazienteId);
      if (ev.bloccoTotale || ev.bloccoTrattamenti) {
        toast.error(`Blocco trattamenti: ${ev.motivi.join(" · ")}`, { duration: 7000 });
        return;
      }
    }

    const sedute = sedutePerPiano[p.id] ?? [];
    const numero = (sedute.at(-1)?.numero_seduta ?? 0) + 1;
    const { error } = await supabase.from("seduta").insert({
      piano_id: p.id,
      paziente_id: pazienteId,
      numero_seduta: numero,
      operatore_id: user?.id,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Seduta ${numero} aggiunta`);
    void load();
  }

  async function completaSeduta(s: Seduta) {
    const { error } = await supabase
      .from("seduta")
      .update({ completata: !s.completata })
      .eq("id", s.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  }

  function toggle(id: string) {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">
            Piani di trattamento
          </h3>
          <p className="text-xs text-muted-foreground">
            Piano → sedute → follow-up.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Nuovo piano
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Nuovo piano</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Titolo *</Label>
                <Input
                  value={titolo}
                  onChange={(e) => setTitolo(e.target.value)}
                  placeholder="Es. Ciclo filler labbra"
                />
              </div>
              <div>
                <Label>Trattamento</Label>
                <Select value={tratId} onValueChange={setTratId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Nessuno —</SelectItem>
                    {trattamenti.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Sedute previste</Label>
                  <Input
                    type="number"
                    min="1"
                    value={numSedute}
                    onChange={(e) => setNumSedute(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Prezzo totale (€)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={prezzo}
                    onChange={(e) => setPrezzo(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Note</Label>
                <Textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={creaPiano} disabled={saving}>
                {saving ? "Creazione…" : "Crea piano"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : piani.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Syringe className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nessun piano di trattamento per questo paziente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {piani.map((p) => {
            const sedute = sedutePerPiano[p.id] ?? [];
            const completate = sedute.filter((s) => s.completata).length;
            const isOpen = expanded.has(p.id);
            return (
              <Card key={p.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-start gap-2 text-left"
                      onClick={() => toggle(p.id)}
                    >
                      {isOpen ? (
                        <ChevronDown className="mt-1 h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-display text-base font-semibold">
                            {p.titolo}
                          </h4>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                              p.stato === "attivo"
                                ? "border-success/40 bg-success/15 text-success-foreground"
                                : p.stato === "completato"
                                  ? "border-border bg-muted text-muted-foreground"
                                  : "border-warning/40 bg-warning/15"
                            }`}
                          >
                            {STATO_LABELS[p.stato]}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {completate} / {p.numero_sedute_previste} sedute
                          {p.prezzo_totale != null
                            ? ` · € ${Number(p.prezzo_totale).toFixed(2)}`
                            : ""}
                        </p>
                      </div>
                    </button>
                    <Select
                      value={p.stato}
                      onValueChange={(v) =>
                        void aggiornaStato(p, v as PianoStato)
                      }
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="attivo">Attivo</SelectItem>
                        <SelectItem value="completato">Completato</SelectItem>
                        <SelectItem value="sospeso">Sospeso</SelectItem>
                        <SelectItem value="annullato">Annullato</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isOpen && (
                    <div className="space-y-2 border-t border-border pt-3">
                      {p.note && (
                        <p className="text-sm text-muted-foreground">{p.note}</p>
                      )}
                      {sedute.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Nessuna seduta registrata.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {sedute.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm"
                            >
                              <span className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void completaSeduta(s)}
                                  className={
                                    s.completata
                                      ? "text-success-foreground"
                                      : "text-muted-foreground hover:text-foreground"
                                  }
                                  title={
                                    s.completata
                                      ? "Segna come non completata"
                                      : "Segna come completata"
                                  }
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </button>
                                <span
                                  className={
                                    s.completata
                                      ? "line-through opacity-60"
                                      : ""
                                  }
                                >
                                  Seduta {s.numero_seduta}
                                </span>
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(s.data_seduta).toLocaleDateString(
                                  "it-IT",
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void aggiungiSeduta(p)}
                      >
                        <Plus className="h-4 w-4" />
                        Aggiungi seduta
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
