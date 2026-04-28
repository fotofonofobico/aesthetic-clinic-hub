import { useEffect, useMemo, useState } from "react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Plus,
  Syringe,
  ChevronDown,
  ChevronRight,
  Trash2,
  PenLine,
  Loader2,
  Package,
  MapPin,
  AlertTriangle,
  Pencil,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  PianoTrattamento,
  Seduta,
  Trattamento,
  PianoStato,
  ProdottoPrevisto,
  PianoVoce,
  ScontoTipo,
} from "@/types/trattamenti";
import { puoEseguireTrattamento } from "@/lib/access-guard";
import { PRODOTTI_DEMO } from "@/lib/prodotti-demo";
import { ZONE_PREDEFINITE } from "@/lib/zone-trattamento";
import {
  applicaSconto,
  calcolaTotaleRighe,
  formatEuro,
  prezzoRiga,
} from "@/lib/piano-prezzo";
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

function parseZone(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.length > 0);
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
  voceId?: string; // presente se esistente (modifica)
  trattamento_id: string;
  numero_sedute: number;
  numero_sedute_min: number; // sedute già completate (vincolo)
  prodotti: { uid: string; prodotto_id: string; quantita: number }[];
  zone: string[];
  zoneDraft: string;
  consensoOk: boolean | null;
  consensoLoading: boolean;
  consensoMotivi: string[];
};

function newRiga(): RigaForm {
  return {
    uid: uid(),
    trattamento_id: "",
    numero_sedute: 1,
    numero_sedute_min: 0,
    prodotti: [],
    zone: [],
    zoneDraft: "",
    consensoOk: null,
    consensoLoading: false,
    consensoMotivi: [],
  };
}

// ---------- consenso per voce piano (lazy) ----------
type ConsensoVoce = { ok: boolean; motivi: string[]; loading: boolean };

export function PianiPanel({ pazienteId }: { pazienteId: string }) {
  const { user } = useAuth();
  const [piani, setPiani] = useState<PianoTrattamento[]>([]);
  const [sedutePerPiano, setSedutePerPiano] = useState<Record<string, Seduta[]>>({});
  const [vociPerPiano, setVociPerPiano] = useState<Record<string, PianoVoce[]>>({});
  const [trattamenti, setTrattamenti] = useState<Trattamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // form
  const [editingPianoId, setEditingPianoId] = useState<string | null>(null);
  const [righe, setRighe] = useState<RigaForm[]>([]);
  const [scontoTipo, setScontoTipo] = useState<ScontoTipo>("nessuno");
  const [scontoValore, setScontoValore] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  // consensi voce (per render piani esistenti)
  const [consensiVoce, setConsensiVoce] = useState<Record<string, ConsensoVoce>>({});

  // sessione firma
  const [firmaSession, setFirmaSession] = useState<SignatureSession | null>(null);
  const [firmaOpen, setFirmaOpen] = useState(false);
  const [firmaVoceKey, setFirmaVoceKey] = useState<string | null>(null);

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
    const lst = (pRes.data ?? []) as unknown as PianoTrattamento[];
    setPiani(lst);

    const sMap: Record<string, Seduta[]> = {};
    for (const raw of sRes.data ?? []) {
      const s = {
        ...(raw as Record<string, unknown>),
        prodotti_previsti: parseProdotti(
          (raw as { prodotti_previsti?: unknown }).prodotti_previsti,
        ),
      } as unknown as Seduta;
      if (s.piano_id) (sMap[s.piano_id] ??= []).push(s);
    }
    setSedutePerPiano(sMap);

    const vMap: Record<string, PianoVoce[]> = {};
    for (const raw of vRes.data ?? []) {
      const v = {
        ...(raw as Record<string, unknown>),
        prodotti_previsti: parseProdotti(
          (raw as { prodotti_previsti?: unknown }).prodotti_previsti,
        ),
        zone: parseZone((raw as { zone?: unknown }).zone),
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
    const r = righe.find((x) => x.uid === rUid);
    if (r && r.numero_sedute_min > 0) {
      toast.error(
        "Non puoi rimuovere un trattamento che ha già sedute completate",
      );
      return;
    }
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
        r.uid === rUid ? { ...r, prodotti: r.prodotti.filter((p) => p.uid !== pUid) } : r,
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

  // ---------- zone riga ----------
  function toggleZona(rUid: string, zona: string) {
    setRighe((cur) =>
      cur.map((r) =>
        r.uid === rUid
          ? {
              ...r,
              zone: r.zone.includes(zona)
                ? r.zone.filter((z) => z !== zona)
                : [...r.zone, zona],
            }
          : r,
      ),
    );
  }

  function aggiungiZonaCustom(rUid: string) {
    setRighe((cur) =>
      cur.map((r) => {
        if (r.uid !== rUid) return r;
        const z = r.zoneDraft.trim();
        if (!z) return r;
        if (r.zone.some((x) => x.toLowerCase() === z.toLowerCase()))
          return { ...r, zoneDraft: "" };
        return { ...r, zone: [...r.zone, z], zoneDraft: "" };
      }),
    );
  }

  // ---------- totale calcolato live ----------
  const totaleBase = useMemo(
    () => calcolaTotaleRighe(righe, trattamenti),
    [righe, trattamenti],
  );
  const { sconto, finale } = useMemo(
    () => applicaSconto(totaleBase, scontoTipo, scontoValore),
    [totaleBase, scontoTipo, scontoValore],
  );

  // ---------- apertura dialog ----------
  function apriNuovo() {
    setEditingPianoId(null);
    setRighe([]);
    setScontoTipo("nessuno");
    setScontoValore(0);
    setOpen(true);
  }

  function apriModifica(p: PianoTrattamento) {
    const voci = vociPerPiano[p.id] ?? [];
    if (voci.length === 0) {
      toast.error("Piano legacy: modifica non disponibile");
      return;
    }
    const sedute = sedutePerPiano[p.id] ?? [];
    const newRighe: RigaForm[] = voci.map((v) => {
      const completate = sedute.filter(
        (s) => s.voce_id === v.id && s.completata,
      ).length;
      return {
        uid: uid(),
        voceId: v.id,
        trattamento_id: v.trattamento_id,
        numero_sedute: v.numero_sedute,
        numero_sedute_min: completate,
        prodotti: v.prodotti_previsti.map((p) => ({
          uid: uid(),
          prodotto_id: p.prodotto_id ?? "",
          quantita: p.quantita,
        })),
        zone: [...v.zone],
        zoneDraft: "",
        consensoOk: null,
        consensoLoading: false,
        consensoMotivi: [],
      };
    });
    setRighe(newRighe);
    setScontoTipo(p.sconto_tipo ?? "nessuno");
    setScontoValore(Number(p.sconto_valore ?? 0));
    setEditingPianoId(p.id);
    setOpen(true);
    // valuta consenso per ogni riga
    for (const r of newRighe) void valutaConsenso(r.uid, r.trattamento_id);
  }

  // ---------- firma consenso da alert piano ----------
  async function avviaFirmaPerVoce(pianoId: string, voceId: string, trattamentoId: string) {
    const session = await buildTrattamentoSession(pazienteId, [trattamentoId]);
    if (!session || session.documenti.length === 0) {
      toast.success("Tutti i consensi richiesti sono già validi");
      void valutaConsensoVoce(pianoId, voceId, trattamentoId);
      return;
    }
    setFirmaSession(session);
    setFirmaVoceKey(`${pianoId}::${voceId}::${trattamentoId}`);
    setFirmaOpen(true);
  }

  async function valutaConsensoVoce(_pianoId: string, voceId: string, trattamentoId: string) {
    setConsensiVoce((cur) => ({
      ...cur,
      [voceId]: { ok: false, motivi: [], loading: true },
    }));
    const res = await puoEseguireTrattamento(pazienteId, trattamentoId);
    setConsensiVoce((cur) => ({
      ...cur,
      [voceId]: { ok: res.ok, motivi: res.motivi, loading: false },
    }));
  }

  // valuta consensi delle voci visibili quando un piano viene espanso
  useEffect(() => {
    for (const pid of expanded) {
      const voci = vociPerPiano[pid] ?? [];
      for (const v of voci) {
        if (!consensiVoce[v.id]) {
          void valutaConsensoVoce(pid, v.id, v.trattamento_id);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, vociPerPiano]);

  // ---------- validazione comune ----------
  function validaForm(): string | null {
    if (righe.length === 0) return "Aggiungi almeno un trattamento al piano";
    if (righe.some((r) => !r.trattamento_id))
      return "Tutte le righe devono avere un trattamento selezionato";
    for (const r of righe) {
      if (r.numero_sedute < 1) return "Il numero di sedute deve essere almeno 1";
      if (r.numero_sedute < r.numero_sedute_min)
        return `Non puoi scendere sotto ${r.numero_sedute_min} sedute (già completate) per un trattamento`;
      if (r.prodotti.some((p) => !p.prodotto_id || p.quantita < 1))
        return "Completa o rimuovi i prodotti con quantità < 1";
    }
    if (scontoTipo === "percento" && (scontoValore < 0 || scontoValore > 100))
      return "Lo sconto in percentuale deve essere tra 0 e 100";
    if (scontoTipo === "euro" && scontoValore < 0)
      return "Lo sconto in € non può essere negativo";
    return null;
  }

  function buildTitolo(): string {
    const nomi = righe.map(
      (r) => trattamenti.find((t) => t.id === r.trattamento_id)?.nome ?? "?",
    );
    return `Piano ${formatDateIT(new Date())} — ${nomi.join(", ")}`;
  }

  function buildVocePayload(r: RigaForm, ordine: number) {
    const prodotti: ProdottoPrevisto[] = r.prodotti.map((p) => {
      const prod = PRODOTTI_DEMO.find((x) => x.id === p.prodotto_id);
      return {
        nome: prod?.nome ?? p.prodotto_id,
        quantita: Math.max(1, Math.floor(p.quantita)),
        prodotto_id: p.prodotto_id,
        trattamento_id: r.trattamento_id,
      };
    });
    return {
      trattamento_id: r.trattamento_id,
      numero_sedute: r.numero_sedute,
      prezzo_unitario: 0,
      prezzo_riga: 0,
      ordine,
      prodotti_previsti: prodotti as unknown as never,
      zone: r.zone as unknown as never,
    };
  }

  // ---------- creazione piano ----------
  async function creaPiano() {
    const err = validaForm();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const totSedute = righe.reduce((acc, r) => acc + r.numero_sedute, 0);

      const { data: pianoData, error: pianoErr } = await supabase
        .from("piano_trattamento")
        .insert({
          paziente_id: pazienteId,
          trattamento_id: null,
          titolo: buildTitolo(),
          numero_sedute_previste: totSedute,
          prezzo_totale: totaleBase,
          prezzo_finale: finale,
          sconto_tipo: scontoTipo,
          sconto_valore: scontoValore,
          note: null,
          created_by: user?.id,
        } as never)
        .select("id")
        .single();
      if (pianoErr || !pianoData) throw pianoErr ?? new Error("Errore creazione piano");
      const pianoId = (pianoData as { id: string }).id;

      const vociPayload = righe.map((r, i) => ({
        piano_id: pianoId,
        ...buildVocePayload(r, i),
      }));
      const { data: vociData, error: vociErr } = await supabase
        .from("piano_trattamento_voce")
        .insert(vociPayload as never)
        .select("id, trattamento_id, numero_sedute, prodotti_previsti");
      if (vociErr || !vociData) throw vociErr ?? new Error("Errore creazione voci");

      const sedutePayload: Array<Record<string, unknown>> = [];
      for (const v of vociData as Array<{
        id: string;
        trattamento_id: string;
        numero_sedute: number;
        prodotti_previsti: unknown;
      }>) {
        const prodottiBase = parseProdotti(v.prodotti_previsti);
        for (let n = 1; n <= v.numero_sedute; n++) {
          sedutePayload.push({
            piano_id: pianoId,
            paziente_id: pazienteId,
            trattamento_id: v.trattamento_id,
            voce_id: v.id,
            numero_seduta: n,
            data_seduta: null, // data da definire
            operatore_id: user?.id,
            completata: false,
            prodotti_previsti: JSON.parse(JSON.stringify(prodottiBase)),
          });
        }
      }
      if (sedutePayload.length > 0) {
        const { error: sErr } = await supabase
          .from("seduta")
          .insert(sedutePayload as never);
        if (sErr) {
          toast.error(`Piano creato ma errore generazione sedute: ${sErr.message}`, {
            duration: 8000,
          });
        }
      }

      toast.success("Piano creato");
      setOpen(false);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setSaving(false);
    }
  }

  // ---------- modifica piano ----------
  async function modificaPiano() {
    if (!editingPianoId) return;
    const err = validaForm();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const pianoId = editingPianoId;
      const vociEsistenti = vociPerPiano[pianoId] ?? [];
      const sedute = sedutePerPiano[pianoId] ?? [];
      const totSedute = righe.reduce((acc, r) => acc + r.numero_sedute, 0);

      // 1. update piano (titolo, totali, sconto, sedute previste)
      const { error: upErr } = await supabase
        .from("piano_trattamento")
        .update({
          titolo: buildTitolo(),
          numero_sedute_previste: totSedute,
          prezzo_totale: totaleBase,
          prezzo_finale: finale,
          sconto_tipo: scontoTipo,
          sconto_valore: scontoValore,
        } as never)
        .eq("id", pianoId);
      if (upErr) throw upErr;

      // 2. voci rimosse: cancella voce + sedute non completate
      const idsForm = new Set(righe.map((r) => r.voceId).filter(Boolean) as string[]);
      const vociDaRimuovere = vociEsistenti.filter((v) => !idsForm.has(v.id));
      for (const v of vociDaRimuovere) {
        // delete sedute non completate
        const { error: dsErr } = await supabase
          .from("seduta")
          .delete()
          .eq("voce_id", v.id)
          .eq("completata", false);
        if (dsErr) throw dsErr;
        // delete voce
        const { error: dvErr } = await supabase
          .from("piano_trattamento_voce")
          .delete()
          .eq("id", v.id);
        if (dvErr) throw dvErr;
      }

      // 3. voci esistenti: update + aggiusta sedute
      let ordine = 0;
      for (const r of righe) {
        if (r.voceId) {
          const vEsistente = vociEsistenti.find((v) => v.id === r.voceId);
          const { error } = await supabase
            .from("piano_trattamento_voce")
            .update({
              ...buildVocePayload(r, ordine),
            } as never)
            .eq("id", r.voceId);
          if (error) throw error;

          // aggiorna prodotti_previsti delle sedute non completate (ri-clona)
          const seduteVoce = sedute.filter((s) => s.voce_id === r.voceId);
          const completate = seduteVoce.filter((s) => s.completata);
          const programmate = seduteVoce.filter((s) => !s.completata);
          const prodottiNuovi = (buildVocePayload(r, ordine).prodotti_previsti as unknown) as ProdottoPrevisto[];

          // aggiorna prodotti su sedute future
          for (const s of programmate) {
            await supabase
              .from("seduta")
              .update({
                prodotti_previsti: JSON.parse(JSON.stringify(prodottiNuovi)),
                trattamento_id: r.trattamento_id,
              } as never)
              .eq("id", s.id);
          }

          const totaleVoceCorrente = seduteVoce.length;
          if (r.numero_sedute > totaleVoceCorrente) {
            const dataMax = seduteVoce.reduce(
              (m, s) => Math.max(m, s.numero_seduta),
              0,
            );
            const insertSed: Array<Record<string, unknown>> = [];
            for (let n = dataMax + 1; n <= dataMax + (r.numero_sedute - totaleVoceCorrente); n++) {
              insertSed.push({
                piano_id: pianoId,
                paziente_id: pazienteId,
                trattamento_id: r.trattamento_id,
                voce_id: r.voceId,
                numero_seduta: n,
                data_seduta: null,
                operatore_id: user?.id,
                completata: false,
                prodotti_previsti: JSON.parse(JSON.stringify(prodottiNuovi)),
              });
            }
            if (insertSed.length > 0) {
              const { error: isErr } = await supabase
                .from("seduta")
                .insert(insertSed as never);
              if (isErr) throw isErr;
            }
          } else if (r.numero_sedute < totaleVoceCorrente) {
            // rimuovi sedute extra non completate, partendo dalle più alte
            const daRimuovere = programmate
              .sort((a, b) => b.numero_seduta - a.numero_seduta)
              .slice(0, totaleVoceCorrente - r.numero_sedute);
            // assicurati che dopo la rimozione restino >= numero_sedute_min completate
            if (completate.length > r.numero_sedute) {
              throw new Error(
                "Impossibile ridurre: ci sono già più sedute completate del nuovo totale",
              );
            }
            for (const s of daRimuovere) {
              const { error: ddErr } = await supabase
                .from("seduta")
                .delete()
                .eq("id", s.id);
              if (ddErr) throw ddErr;
            }
          }
        } else {
          // voce nuova
          const { data: vNew, error } = await supabase
            .from("piano_trattamento_voce")
            .insert({ piano_id: pianoId, ...buildVocePayload(r, ordine) } as never)
            .select("id, trattamento_id, numero_sedute, prodotti_previsti")
            .single();
          if (error || !vNew) throw error ?? new Error("Errore creazione voce");
          const v = vNew as {
            id: string;
            trattamento_id: string;
            numero_sedute: number;
            prodotti_previsti: unknown;
          };
          const prodotti = parseProdotti(v.prodotti_previsti);
          const insertSed: Array<Record<string, unknown>> = [];
          for (let n = 1; n <= v.numero_sedute; n++) {
            insertSed.push({
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
          if (insertSed.length > 0) {
            const { error: isErr } = await supabase
              .from("seduta")
              .insert(insertSed as never);
            if (isErr) throw isErr;
          }
        }
        ordine += 1;
      }

      toast.success("Piano aggiornato");
      setOpen(false);
      setEditingPianoId(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore sconosciuto");
    } finally {
      setSaving(false);
    }
  }

  // ---------- stato piano (manuale, esclude completato) ----------
  async function aggiornaStato(p: PianoTrattamento, stato: PianoStato) {
    if (stato === "completato") {
      toast.info(
        "Lo stato 'completato' è automatico al termine di tutte le sedute",
      );
      return;
    }
    const { error } = await supabase
      .from("piano_trattamento")
      .update({ stato } as never)
      .eq("id", p.id);
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

  // ---------- riepilogo paziente ----------
  const totalePaziente = useMemo(() => {
    let tot = 0;
    let attivi = 0;
    let completati = 0;
    for (const p of piani) {
      if (p.stato === "annullato") continue;
      const v = typeof p.prezzo_finale === "number" ? p.prezzo_finale : (p.prezzo_totale ?? 0);
      tot += Number(v) || 0;
      if (p.stato === "attivo") attivi += 1;
      else if (p.stato === "completato") completati += 1;
    }
    return { tot: Math.round(tot * 100) / 100, attivi, completati };
  }, [piani]);

  // ---------- render ----------
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">Piani di trattamento</h3>
          <p className="text-xs text-muted-foreground">
            Pianifica trattamenti, prodotti, zone e prezzo. Le sedute si registrano in seduta.
          </p>
        </div>
        <Button onClick={apriNuovo}>
          <Plus className="h-4 w-4" />
          Nuovo piano
        </Button>
      </div>

      {piani.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Totale piani paziente
              </p>
              <p className="font-display text-xl font-bold">
                {formatEuro(totalePaziente.tot)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Attivi: {totalePaziente.attivi} · Completati: {totalePaziente.completati}
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) {
            setEditingPianoId(null);
            setRighe([]);
            setScontoTipo("nessuno");
            setScontoValore(0);
          }
        }}
      >
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingPianoId ? "Modifica piano" : "Nuovo piano"}
            </DialogTitle>
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
                          disabled={!!r.voceId && r.numero_sedute_min > 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona trattamento…" />
                          </SelectTrigger>
                          <SelectContent>
                            {trattamenti.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.nome}
                                {t.tipo === "ciclo" ? " (ciclo)" : ""}
                                {typeof t.prezzo_indicativo === "number"
                                  ? ` · ${formatEuro(t.prezzo_indicativo)}`
                                  : ""}
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
                        title={
                          r.numero_sedute_min > 0
                            ? "Trattamento con sedute completate, non rimovibile"
                            : "Rimuovi"
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                      <div className="w-28">
                        <Label className="text-xs">Sedute</Label>
                        <Input
                          type="number"
                          min={Math.max(1, r.numero_sedute_min)}
                          step={1}
                          value={r.numero_sedute}
                          onChange={(e) =>
                            patchRiga(r.uid, {
                              numero_sedute: Math.max(
                                Math.max(1, r.numero_sedute_min),
                                Math.floor(Number(e.target.value) || 1),
                              ),
                            })
                          }
                        />
                        {r.numero_sedute_min > 0 && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            min {r.numero_sedute_min} (completate)
                          </p>
                        )}
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
                            🔴 Consenso mancante (firma dopo aver salvato il piano)
                          </span>
                        ) : (
                          r.trattamento_id && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )
                        )}
                      </div>
                    </div>

                    {/* Prodotti previsti */}
                    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                          <Package className="h-3 w-3" />
                          Prodotti previsti (conteggio)
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
                                      {prod.nome}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Input
                                type="number"
                                step={1}
                                min={1}
                                className="h-8 w-20 text-xs"
                                value={p.quantita}
                                onChange={(e) =>
                                  patchProdotto(r.uid, p.uid, {
                                    quantita: Math.max(
                                      1,
                                      Math.floor(Number(e.target.value) || 1),
                                    ),
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

                    {/* Zone */}
                    <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                      <Label className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        Zone previste
                      </Label>
                      <div className="flex flex-wrap gap-1">
                        {ZONE_PREDEFINITE.map((z) => {
                          const sel = r.zone.includes(z);
                          return (
                            <button
                              key={z}
                              type="button"
                              onClick={() => toggleZona(r.uid, z)}
                              className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                                sel
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background text-foreground hover:bg-muted"
                              }`}
                            >
                              {z}
                            </button>
                          );
                        })}
                        {r.zone
                          .filter((z) => !ZONE_PREDEFINITE.includes(z))
                          .map((z) => (
                            <span
                              key={z}
                              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-[11px]"
                            >
                              {z}
                              <button
                                type="button"
                                onClick={() => toggleZona(r.uid, z)}
                                className="opacity-70 hover:opacity-100"
                                aria-label="Rimuovi zona"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Aggiungi zona personalizzata…"
                          className="h-8 text-xs"
                          value={r.zoneDraft}
                          onChange={(e) => patchRiga(r.uid, { zoneDraft: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              aggiungiZonaCustom(r.uid);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => aggiungiZonaCustom(r.uid)}
                        >
                          Aggiungi
                        </Button>
                      </div>
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

            {/* Totale + sconto */}
            {righe.length > 0 && (
              <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Totale base</span>
                  <span className="font-medium">{formatEuro(totaleBase)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Sconto
                  </Label>
                  <Select
                    value={scontoTipo}
                    onValueChange={(v) => setScontoTipo(v as ScontoTipo)}
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nessuno">Nessuno</SelectItem>
                      <SelectItem value="euro">€</SelectItem>
                      <SelectItem value="percento">%</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step={scontoTipo === "percento" ? 1 : 0.01}
                    max={scontoTipo === "percento" ? 100 : undefined}
                    className="h-8 w-28"
                    disabled={scontoTipo === "nessuno"}
                    value={scontoValore}
                    onChange={(e) => setScontoValore(Number(e.target.value) || 0)}
                  />
                  {scontoTipo !== "nessuno" && (
                    <span className="text-xs text-muted-foreground">
                      − {formatEuro(sconto)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="font-display text-sm uppercase tracking-wide">
                    Totale finale
                  </span>
                  <span className="font-display text-lg font-bold">
                    {formatEuro(finale)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={() => void (editingPianoId ? modificaPiano() : creaPiano())}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />{" "}
                  {editingPianoId ? "Salvataggio…" : "Creazione…"}
                </>
              ) : editingPianoId ? (
                "Salva modifiche"
              ) : (
                "Crea piano"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            const isLegacy = voci.length === 0;
            // alert consenso aggregato
            const vociMancanti = voci.filter((v) => consensiVoce[v.id]?.ok === false);
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
                          {new Date(p.created_at).toLocaleDateString("it-IT")} ·{" "}
                          {completate} / {p.numero_sedute_previste} sedute
                          {voci.length > 0 ? ` · ${voci.length} trattamento/i` : ""}
                          {typeof p.prezzo_finale === "number"
                            ? ` · ${formatEuro(p.prezzo_finale)}`
                            : typeof p.prezzo_totale === "number"
                              ? ` · ${formatEuro(p.prezzo_totale)}`
                              : ""}
                        </p>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      {!isLegacy && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => apriModifica(p)}
                          disabled={p.stato === "annullato"}
                        >
                          <Pencil className="h-3 w-3" />
                          Modifica
                        </Button>
                      )}
                      <Select
                        value={p.stato}
                        onValueChange={(v) => void aggiornaStato(p, v as PianoStato)}
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="attivo">Attivo</SelectItem>
                          <SelectItem value="sospeso">Sospeso</SelectItem>
                          <SelectItem value="annullato">Annullato</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Alert consenso aggregato */}
                  {!isLegacy && isOpen && vociMancanti.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>
                        Consenso mancante per {vociMancanti.length} trattamento/i
                      </AlertTitle>
                      <AlertDescription>
                        Firma il consenso prima di iniziare le sedute. Lo trovi
                        accanto a ogni trattamento qui sotto.
                      </AlertDescription>
                    </Alert>
                  )}

                  {isOpen && (
                    <div className="space-y-3 border-t border-border pt-3">
                      {!isLegacy ? (
                        voci.map((v) => {
                          const trattNome =
                            trattamenti.find((t) => t.id === v.trattamento_id)?.nome ??
                            "Trattamento";
                          const seduteVoce = sedute.filter((s) => s.voce_id === v.id);
                          const completateVoce = seduteVoce.filter(
                            (s) => s.completata,
                          ).length;
                          const cv = consensiVoce[v.id];
                          return (
                            <div
                              key={v.id}
                              className="space-y-2 rounded-md border border-border bg-card p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{trattNome}</span>
                                  {cv?.loading ? (
                                    <span className="text-[11px] text-muted-foreground">
                                      <Loader2 className="inline h-3 w-3 animate-spin" />
                                    </span>
                                  ) : cv?.ok === true ? (
                                    <span className="rounded-full border border-success/40 bg-success/15 px-2 py-0.5 text-[10px] text-success-foreground">
                                      🟢 Consenso ok
                                    </span>
                                  ) : cv?.ok === false ? (
                                    <span className="rounded-full border border-destructive/40 bg-destructive/15 px-2 py-0.5 text-[10px] text-destructive-foreground">
                                      🔴 Consenso mancante
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                  {cv?.ok === false && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        void avviaFirmaPerVoce(p.id, v.id, v.trattamento_id)
                                      }
                                    >
                                      <PenLine className="h-3 w-3" />
                                      Firma consenso
                                    </Button>
                                  )}
                                  <span className="text-xs font-medium">
                                    {formatEuro(
                                      prezzoRiga(
                                        trattamenti.find((t) => t.id === v.trattamento_id),
                                        v.numero_sedute,
                                      ),
                                    )}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {completateVoce} / {v.numero_sedute} sedute
                                  </span>
                                </div>
                              </div>

                              {v.zone.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {v.zone.map((z, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px]"
                                    >
                                      <MapPin className="h-3 w-3" />
                                      {z}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {v.prodotti_previsti.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {v.prodotti_previsti.map((prod, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[11px]"
                                    >
                                      <Package className="h-3 w-3" />
                                      {prod.nome} × {prod.quantita}
                                    </span>
                                  ))}
                                </div>
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
                          <p className="text-xs text-muted-foreground">
                            Piano legacy: {p.numero_sedute_previste} sedute previste,{" "}
                            {completate} completate.
                          </p>
                        </>
                      )}

                      {!isLegacy && voci.length > 0 && (() => {
                        const base = voci.reduce(
                          (acc, v) =>
                            acc +
                            prezzoRiga(
                              trattamenti.find((t) => t.id === v.trattamento_id),
                              v.numero_sedute,
                            ),
                          0,
                        );
                        const { sconto: sc, finale: fin } = applicaSconto(
                          base,
                          (p.sconto_tipo ?? "nessuno") as ScontoTipo,
                          Number(p.sconto_valore ?? 0),
                        );
                        return (
                          <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Totale base</span>
                              <span>{formatEuro(base)}</span>
                            </div>
                            {sc > 0 && (
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>
                                  Sconto
                                  {p.sconto_tipo === "percento"
                                    ? ` (${Number(p.sconto_valore)}%)`
                                    : ""}
                                </span>
                                <span>− {formatEuro(sc)}</span>
                              </div>
                            )}
                            <div className="flex items-center justify-between border-t border-border pt-1">
                              <span className="font-display uppercase tracking-wide">
                                Totale finale
                              </span>
                              <span className="font-display text-base font-bold">
                                {formatEuro(fin)}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog firma consenso da alert piano */}
      <SignatureSessionDialog
        open={firmaOpen}
        session={firmaSession}
        onClose={() => {
          setFirmaOpen(false);
          if (firmaVoceKey) {
            const [pid, vid, tid] = firmaVoceKey.split("::");
            if (pid && vid && tid) void valutaConsensoVoce(pid, vid, tid);
          }
        }}
        onCompleted={() => {
          setFirmaOpen(false);
          if (firmaVoceKey) {
            const [pid, vid, tid] = firmaVoceKey.split("::");
            if (pid && vid && tid) void valutaConsensoVoce(pid, vid, tid);
          }
        }}
      />
    </div>
  );
}
