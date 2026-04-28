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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Syringe,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Trash2,
  PenLine,
  Loader2,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import type {
  PianoTrattamento,
  Seduta,
  Trattamento,
  PianoStato,
  ProdottoPrevisto,
  PianoVoce,
} from "@/types/trattamenti";
import { puoEseguireTrattamento, evaluateAccess } from "@/lib/access-guard";
import { PRODOTTI_DEMO } from "@/lib/prodotti-demo";
import { buildTrattamentoSession, type SignatureSession } from "@/lib/signature-session";
import { SignatureSessionDialog } from "@/components/signature-session-dialog";

const STATO_LABELS: Record<PianoStato, string> = {
  attivo: "Attivo",
  completato: "Completato",
  sospeso: "Sospeso",
  annullato: "Annullato",
};

// ---------- helpers ----------
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseProdotti(value: unknown): ProdottoPrevisto[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      nome: typeof v.nome === "string" ? v.nome : "",
      quantita: typeof v.quantita === "number" ? v.quantita : Number(v.quantita) || 0,
      trattamento_id: (v.trattamento_id as string | null | undefined) ?? null,
      prodotto_id: (v.prodotto_id as string | null | undefined) ?? null,
    }))
    .filter((p) => p.nome.length > 0);
}

function defaultSedute(t: Trattamento | undefined): number {
  if (!t) return 1;
  if (t.tipo === "ciclo") return Math.max(1, t.durata_ciclo_valore ?? 3);
  return 1;
}

function formatDateIT(d: Date) {
  return d.toLocaleDateString("it-IT");
}

// ---------- riga form ----------
type RigaForm = {
  uid: string;
  trattamento_id: string;
  numero_sedute: number;
  prodotti: { uid: string; prodotto_id: string; quantita: number }[];
  consensoOk: boolean | null;
  consensoLoading: boolean;
  consensoMotivi: string[];
};

function newRiga(): RigaForm {
  return {
    uid: uid(),
    trattamento_id: "",
    numero_sedute: 1,
    prodotti: [],
    consensoOk: null,
    consensoLoading: false,
    consensoMotivi: [],
  };
}

export function PianiPanel({ pazienteId }: { pazienteId: string }) {
  const { user } = useAuth();
  const [piani, setPiani] = useState<PianoTrattamento[]>([]);
  const [sedutePerPiano, setSedutePerPiano] = useState<Record<string, Seduta[]>>({});
  const [vociPerPiano, setVociPerPiano] = useState<Record<string, PianoVoce[]>>({});
  const [trattamenti, setTrattamenti] = useState<Trattamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // form nuovo piano
  const [righe, setRighe] = useState<RigaForm[]>([]);
  const [saving, setSaving] = useState(false);

  // sessione firma per riga
  const [firmaSession, setFirmaSession] = useState<SignatureSession | null>(null);
  const [firmaOpen, setFirmaOpen] = useState(false);
  const [firmaRigaUid, setFirmaRigaUid] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [pazienteId]);

  async function load() {
    setLoading(true);
    const [pRes, sRes, vRes, tRes] = await Promise.all([
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
      supabase
        .from("piano_trattamento_voce")
        .select("*")
        .order("ordine"),
      supabase.from("trattamenti").select("*").eq("attivo", true).order("nome"),
    ]);
    const lst = (pRes.data ?? []) as PianoTrattamento[];
    setPiani(lst);

    const sMap: Record<string, Seduta[]> = {};
    for (const raw of sRes.data ?? []) {
      const s = {
        ...(raw as Record<string, unknown>),
        prodotti_previsti: parseProdotti((raw as { prodotti_previsti?: unknown }).prodotti_previsti),
      } as unknown as Seduta;
      (sMap[s.piano_id] ??= []).push(s);
    }
    setSedutePerPiano(sMap);

    const vMap: Record<string, PianoVoce[]> = {};
    for (const raw of vRes.data ?? []) {
      const v = {
        ...(raw as Record<string, unknown>),
        prodotti_previsti: parseProdotti(
          (raw as { prodotti_previsti?: unknown }).prodotti_previsti,
        ),
      } as unknown as PianoVoce;
      (vMap[v.piano_id] ??= []).push(v);
    }
    setVociPerPiano(vMap);

    setTrattamenti((tRes.data ?? []) as Trattamento[]);
    setLoading(false);
  }

  // ---------- gestione righe form ----------
  function aggiungiRiga() {
    setRighe((cur) => [...cur, newRiga()]);
  }

  function rimuoviRiga(rUid: string) {
    setRighe((cur) => cur.filter((r) => r.uid !== rUid));
  }

  function patchRiga(rUid: string, patch: Partial<RigaForm>) {
    setRighe((cur) => cur.map((r) => (r.uid === rUid ? { ...r, ...patch } : r)));
  }

  async function valutaConsenso(rUid: string, trattamentoId: string) {
    if (!trattamentoId) return;
    patchRiga(rUid, { consensoLoading: true });
    try {
      const res = await puoEseguireTrattamento(pazienteId, trattamentoId);
      patchRiga(rUid, {
        consensoOk: res.ok,
        consensoMotivi: res.motivi,
        consensoLoading: false,
      });
    } catch {
      patchRiga(rUid, { consensoOk: null, consensoLoading: false, consensoMotivi: [] });
    }
  }

  function onTrattamentoChange(rUid: string, trattamentoId: string) {
    const t = trattamenti.find((x) => x.id === trattamentoId);
    patchRiga(rUid, {
      trattamento_id: trattamentoId,
      numero_sedute: defaultSedute(t),
      consensoOk: null,
      consensoMotivi: [],
    });
    void valutaConsenso(rUid, trattamentoId);
  }

  // ---------- prodotti riga ----------
  function aggiungiProdotto(rUid: string) {
    setRighe((cur) =>
      cur.map((r) =>
        r.uid === rUid
          ? {
              ...r,
              prodotti: [
                ...r.prodotti,
                { uid: uid(), prodotto_id: "", quantita: 1 },
              ],
            }
          : r,
      ),
    );
  }

  function rimuoviProdotto(rUid: string, pUid: string) {
    setRighe((cur) =>
      cur.map((r) =>
        r.uid === rUid
          ? { ...r, prodotti: r.prodotti.filter((p) => p.uid !== pUid) }
          : r,
      ),
    );
  }

  function patchProdotto(
    rUid: string,
    pUid: string,
    patch: Partial<{ prodotto_id: string; quantita: number }>,
  ) {
    setRighe((cur) =>
      cur.map((r) =>
        r.uid === rUid
          ? {
              ...r,
              prodotti: r.prodotti.map((p) => (p.uid === pUid ? { ...p, ...patch } : p)),
            }
          : r,
      ),
    );
  }

  // ---------- firma da riga ----------
  async function avviaFirmaRiga(r: RigaForm) {
    if (!r.trattamento_id) {
      toast.error("Seleziona prima un trattamento");
      return;
    }
    const session = await buildTrattamentoSession(pazienteId, [r.trattamento_id]);
    if (!session || session.documenti.length === 0) {
      toast.success("Tutti i consensi richiesti sono già validi");
      void valutaConsenso(r.uid, r.trattamento_id);
      return;
    }
    setFirmaSession(session);
    setFirmaRigaUid(r.uid);
    setFirmaOpen(true);
  }

  // ---------- creazione piano ----------
  function resetForm() {
    setRighe([]);
  }

  async function creaPiano() {
    if (righe.length === 0) {
      toast.error("Aggiungi almeno un trattamento al piano");
      return;
    }
    if (righe.some((r) => !r.trattamento_id)) {
      toast.error("Tutte le righe devono avere un trattamento selezionato");
      return;
    }
    if (righe.some((r) => r.numero_sedute < 1)) {
      toast.error("Il numero di sedute deve essere almeno 1");
      return;
    }
    if (righe.some((r) => r.prodotti.some((p) => !p.prodotto_id || p.quantita <= 0))) {
      toast.error("Completa o rimuovi i prodotti incompleti");
      return;
    }
    const senzaProdotti = righe.filter((r) => r.prodotti.length === 0);
    if (senzaProdotti.length > 0) {
      toast.warning(
        `${senzaProdotti.length} riga/e senza prodotti previsti — procedo comunque`,
      );
    }

    setSaving(true);
    try {
      const nomi = righe.map((r) => trattamenti.find((t) => t.id === r.trattamento_id)?.nome ?? "?");
      const titolo = `Piano ${formatDateIT(new Date())} — ${nomi.join(", ")}`;
      const totSedute = righe.reduce((acc, r) => acc + r.numero_sedute, 0);

      // 1. Piano
      const { data: pianoData, error: pianoErr } = await supabase
        .from("piano_trattamento")
        .insert({
          paziente_id: pazienteId,
          trattamento_id: null,
          titolo,
          numero_sedute_previste: totSedute,
          prezzo_totale: null,
          note: null,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (pianoErr || !pianoData) throw pianoErr ?? new Error("Errore creazione piano");
      const pianoId = pianoData.id;

      // 2. Voci (con ritorno per generare sedute)
      const vociPayload = righe.map((r, i) => {
        const prodottiJson: ProdottoPrevisto[] = r.prodotti.map((p) => {
          const prod = PRODOTTI_DEMO.find((x) => x.id === p.prodotto_id);
          return {
            nome: prod?.nome ?? p.prodotto_id,
            quantita: p.quantita,
            prodotto_id: p.prodotto_id,
            trattamento_id: r.trattamento_id,
          };
        });
        return {
          piano_id: pianoId,
          trattamento_id: r.trattamento_id,
          numero_sedute: r.numero_sedute,
          prezzo_unitario: 0,
          prezzo_riga: 0,
          ordine: i,
          prodotti_previsti: prodottiJson as unknown as never,
        };
      });

      const { data: vociData, error: vociErr } = await supabase
        .from("piano_trattamento_voce")
        .insert(vociPayload)
        .select("id, trattamento_id, numero_sedute, prodotti_previsti, ordine");
      if (vociErr || !vociData) throw vociErr ?? new Error("Errore creazione voci");

      // 3. Sedute (deep clone prodotti per evitare mutazione condivisa)
      const sedutePayload: Array<Record<string, unknown>> = [];
      for (const v of vociData) {
        const prodotti = parseProdotti(v.prodotti_previsti as unknown);
        for (let n = 1; n <= v.numero_sedute; n++) {
          sedutePayload.push({
            piano_id: pianoId,
            paziente_id: pazienteId,
            trattamento_id: v.trattamento_id,
            voce_id: v.id,
            numero_seduta: n,
            operatore_id: user?.id,
            completata: false,
            prodotti_previsti: JSON.parse(JSON.stringify(prodotti)),
          });
        }
      }
      if (sedutePayload.length > 0) {
        const { error: sErr } = await supabase
          .from("seduta")
          .insert(sedutePayload as never);
        if (sErr) {
          toast.error(
            `Piano creato ma errore nella generazione delle sedute: ${sErr.message}`,
            { duration: 8000 },
          );
        }
      }

      toast.success("Piano creato");
      setOpen(false);
      resetForm();
      void load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore sconosciuto";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  // ---------- azioni piano esistente ----------
  async function aggiornaStato(p: PianoTrattamento, stato: PianoStato) {
    const { error } = await supabase.from("piano_trattamento").update({ stato }).eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  }

  async function aggiungiSeduta(p: PianoTrattamento) {
    if (p.trattamento_id) {
      const guard = await puoEseguireTrattamento(pazienteId, p.trattamento_id);
      if (!guard.ok) {
        toast.error(`Impossibile aggiungere seduta. ${guard.motivi.join(" · ")}`, {
          duration: 7000,
        });
        return;
      }
    } else {
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
    } as never);
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

  // ---------- render ----------
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">Piani di trattamento</h3>
          <p className="text-xs text-muted-foreground">
            Piano → trattamenti → sedute → prodotti previsti.
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
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Nuovo piano</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              {righe.length === 0 && (
                <p className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Aggiungi uno o più trattamenti per costruire il piano.
                </p>
              )}

              {righe.map((r, idx) => {
                const tratt = trattamenti.find((t) => t.id === r.trattamento_id);
                return (
                  <Card key={r.uid} className="border-border">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 space-y-1">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            Trattamento #{idx + 1}
                          </Label>
                          <Select
                            value={r.trattamento_id || undefined}
                            onValueChange={(v) => onTrattamentoChange(r.uid, v)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona trattamento…" />
                            </SelectTrigger>
                            <SelectContent>
                              {trattamenti.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.nome}
                                  {t.tipo === "ciclo" ? " (ciclo)" : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mt-5 text-muted-foreground hover:text-destructive"
                          onClick={() => rimuoviRiga(r.uid)}
                          title="Rimuovi riga"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-end gap-3">
                        <div className="w-28">
                          <Label className="text-xs">Sedute</Label>
                          <Input
                            type="number"
                            min={1}
                            value={r.numero_sedute}
                            onChange={(e) =>
                              patchRiga(r.uid, {
                                numero_sedute: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                          />
                        </div>

                        <div className="flex flex-1 items-center gap-2">
                          {r.consensoLoading ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Verifica…
                            </span>
                          ) : r.consensoOk === true ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-xs text-success-foreground">
                              🟢 Consenso valido
                            </span>
                          ) : r.consensoOk === false ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-xs text-destructive-foreground"
                              title={r.consensoMotivi.join(" · ")}
                            >
                              🔴 Consenso mancante
                            </span>
                          ) : (
                            r.trattamento_id && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )
                          )}
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!r.trattamento_id || r.consensoOk === true}
                          onClick={() => void avviaFirmaRiga(r)}
                        >
                          <PenLine className="h-4 w-4" />
                          Firma consenso
                        </Button>
                      </div>

                      {/* Prodotti previsti */}
                      <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                            <Package className="h-3 w-3" />
                            Prodotti previsti
                          </Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => aggiungiProdotto(r.uid)}
                          >
                            <Plus className="h-3 w-3" />
                            Aggiungi
                          </Button>
                        </div>

                        {r.prodotti.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Nessun prodotto previsto.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {r.prodotti.map((p) => (
                              <div key={p.uid} className="flex items-center gap-2">
                                <Select
                                  value={p.prodotto_id || undefined}
                                  onValueChange={(v) =>
                                    patchProdotto(r.uid, p.uid, { prodotto_id: v })
                                  }
                                >
                                  <SelectTrigger className="h-8 flex-1 text-xs">
                                    <SelectValue placeholder="Seleziona prodotto…" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PRODOTTI_DEMO.map((prod) => (
                                      <SelectItem key={prod.id} value={prod.id}>
                                        {prod.nome}{" "}
                                        <span className="text-muted-foreground">
                                          ({prod.unita})
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  className="h-8 w-20 text-xs"
                                  value={p.quantita}
                                  onChange={(e) =>
                                    patchProdotto(r.uid, p.uid, {
                                      quantita: Number(e.target.value) || 0,
                                    })
                                  }
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => rimuoviProdotto(r.uid, p.uid)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {tratt?.tipo === "ciclo" && tratt.durata_ciclo_valore && (
                        <p className="text-[11px] text-muted-foreground">
                          Ciclo consigliato: {tratt.durata_ciclo_valore}{" "}
                          {tratt.durata_ciclo_unita ?? ""}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={aggiungiRiga}
              >
                <Plus className="h-4 w-4" />
                Aggiungi trattamento al piano
              </Button>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Annulla
              </Button>
              <Button onClick={() => void creaPiano()} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Creazione…
                  </>
                ) : (
                  "Crea piano"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista piani esistenti */}
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
            const voci = vociPerPiano[p.id] ?? [];
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
                          <h4 className="font-display text-base font-semibold">{p.titolo}</h4>
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
                          {voci.length > 0 ? ` · ${voci.length} trattamento/i` : ""}
                        </p>
                      </div>
                    </button>
                    <Select
                      value={p.stato}
                      onValueChange={(v) => void aggiornaStato(p, v as PianoStato)}
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
                    <div className="space-y-3 border-t border-border pt-3">
                      {/* Render multi-voce (piani nuovi) */}
                      {voci.length > 0 ? (
                        voci.map((v) => {
                          const trattNome =
                            trattamenti.find((t) => t.id === v.trattamento_id)?.nome ??
                            "Trattamento";
                          const seduteVoce = sedute.filter((s) => s.voce_id === v.id);
                          const completateVoce = seduteVoce.filter((s) => s.completata).length;
                          return (
                            <div
                              key={v.id}
                              className="space-y-2 rounded-md border border-border bg-card p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="font-medium">{trattNome}</div>
                                <div className="text-xs text-muted-foreground">
                                  {completateVoce} / {v.numero_sedute} sedute
                                </div>
                              </div>

                              {v.prodotti_previsti.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {v.prodotti_previsti.map((prod, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px]"
                                    >
                                      <Package className="h-3 w-3" />
                                      {prod.nome} · {prod.quantita}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {seduteVoce.length > 0 && (
                                <ul className="space-y-1">
                                  {seduteVoce.map((s) => (
                                    <li
                                      key={s.id}
                                      className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-sm"
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
                                        >
                                          <CheckCircle2 className="h-4 w-4" />
                                        </button>
                                        <span
                                          className={
                                            s.completata ? "line-through opacity-60" : ""
                                          }
                                        >
                                          Seduta {s.numero_seduta}
                                          {!s.completata && (
                                            <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                                              programmata
                                            </span>
                                          )}
                                        </span>
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(s.data_seduta).toLocaleDateString("it-IT")}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        // Fallback piani vecchi
                        <>
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
                                    >
                                      <CheckCircle2 className="h-4 w-4" />
                                    </button>
                                    <span
                                      className={s.completata ? "line-through opacity-60" : ""}
                                    >
                                      Seduta {s.numero_seduta}
                                    </span>
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(s.data_seduta).toLocaleDateString("it-IT")}
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
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog firma consenso per riga (riusa SignatureSessionDialog senza modificarlo) */}
      <SignatureSessionDialog
        open={firmaOpen}
        session={firmaSession}
        onClose={() => {
          setFirmaOpen(false);
          // Riverifica consenso della riga al termine, indipendentemente dall'esito
          if (firmaRigaUid) {
            const r = righe.find((x) => x.uid === firmaRigaUid);
            if (r?.trattamento_id) void valutaConsenso(r.uid, r.trattamento_id);
          }
        }}
        onCompleted={() => {
          setFirmaOpen(false);
          if (firmaRigaUid) {
            const r = righe.find((x) => x.uid === firmaRigaUid);
            if (r?.trattamento_id) void valutaConsenso(r.uid, r.trattamento_id);
          }
        }}
      />
    </div>
  );
}
