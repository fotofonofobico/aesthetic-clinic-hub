import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileSignature,
  History,
  Lock,
  MapPin,
  Package,
  Pencil,
  Plus,
  ShieldAlert,
  Stethoscope,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type {
  PianoTrattamento,
  PianoVoce,
  ProdottoPrevisto,
  Seduta,
  SedutaModifica,
  Trattamento,
} from "@/types/trattamenti";
import { PRODOTTI_DEMO } from "@/lib/prodotti-demo";
import { ZONE_PREDEFINITE } from "@/lib/zone-trattamento";
import { ConsumoMagazzinoStep, righeToRigheConsumo, type ConsumoRiga } from "@/components/magazzino/consumo-step";
import { consumaSeduta } from "@/lib/magazzino";
import {
  dataClinica,
  diffPerAudit,
  entroFinestra48h,
  formatProdotti,
  registraModificheSeduta,
  statoSeduta,
  valutaModificaSeduta,
  type StatoSeduta,
} from "@/lib/seduta-helpers";
import { puoEseguireTrattamento } from "@/lib/access-guard";
import { buildTrattamentoSession, type SignatureSession } from "@/lib/signature-session";
import { SignatureSessionDialog } from "@/components/signature-session-dialog";
import { FotoBaselineDialog } from "@/components/foto/foto-baseline-dialog";
import { FotoUploadDialog } from "@/components/foto/foto-upload-dialog";
import { FotoGrid } from "@/components/foto/foto-grid";
import { getStatoPiano, listFotoByPiano } from "@/lib/foto-clinica";
import type { FotoClinica, FotoMomento } from "@/types/foto-clinica";

// ───────────────────────────── Helpers locali ─────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2);
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

function fmtData(s: string) {
  return new Date(s).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDataOra(s: string) {
  return new Date(s).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

// ───────────────────────────── Tipi locali ─────────────────────────────

type TrattMap = Map<string, Trattamento>;

interface Riga extends Seduta {
  trattamento?: Trattamento;
  piano?: PianoTrattamento;
  voce?: PianoVoce;
  consensoOk: boolean | null;
  consensoMotivi: string[];
}

// ───────────────────────────── Componente principale ─────────────────────────────

export function SedutePanel({ pazienteId }: { pazienteId: string }) {
  const { user, hasRole } = useAuth();
  const [sedute, setSedute] = useState<Seduta[]>([]);
  const [piani, setPiani] = useState<PianoTrattamento[]>([]);
  const [voci, setVoci] = useState<PianoVoce[]>([]);
  const [trattamenti, setTrattamenti] = useState<Trattamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"tutte" | "programmate" | "eseguite">("tutte");

  const [eseguiSeduta, setEseguiSeduta] = useState<Seduta | null>(null);
  const [modificaSeduta, setModificaSeduta] = useState<Seduta | null>(null);
  const [spotOpen, setSpotOpen] = useState(false);
  const [auditSeduta, setAuditSeduta] = useState<Seduta | null>(null);

  // firma consenso al volo
  const [firmaSession, setFirmaSession] = useState<SignatureSession | null>(null);
  const [firmaOpen, setFirmaOpen] = useState(false);
  const [pendingExecAfterFirma, setPendingExecAfterFirma] = useState<Seduta | null>(null);

  // Foto baseline non bloccante
  const [baselineDialog, setBaselineDialog] = useState<{
    seduta: Seduta;
    incoerenza: boolean;
  } | null>(null);
  // Upload rapido foto (post-seduta DOPO o caricamento baseline da dialog)
  const [uploadFoto, setUploadFoto] = useState<{
    paziente_id: string;
    piano_id: string;
    seduta_id: string | null;
    momento: FotoMomento;
  } | null>(null);

  useEffect(() => {
    void load();
  }, [pazienteId]);

  async function load() {
    setLoading(true);
    const [sRes, pRes, vRes, tRes] = await Promise.all([
      supabase
        .from("seduta")
        .select("*")
        .eq("paziente_id", pazienteId)
        .order("data_seduta", { ascending: false }),
      supabase.from("piano_trattamento").select("*").eq("paziente_id", pazienteId),
      supabase.from("piano_trattamento_voce").select("*"),
      supabase.from("trattamenti").select("*"),
    ]);

    const sList = (sRes.data ?? []).map((raw) => ({
      ...(raw as Record<string, unknown>),
      prodotti_previsti: parseProdotti(
        (raw as { prodotti_previsti?: unknown }).prodotti_previsti,
      ),
    })) as unknown as Seduta[];

    const vList = (vRes.data ?? []).map((raw) => ({
      ...(raw as Record<string, unknown>),
      prodotti_previsti: parseProdotti(
        (raw as { prodotti_previsti?: unknown }).prodotti_previsti,
      ),
      zone: parseZone((raw as { zone?: unknown }).zone),
    })) as unknown as PianoVoce[];

    setSedute(sList);
    setPiani((pRes.data ?? []) as unknown as PianoTrattamento[]);
    setVoci(vList);
    setTrattamenti((tRes.data ?? []) as Trattamento[]);
    setLoading(false);
  }

  const trattMap: TrattMap = useMemo(
    () => new Map(trattamenti.map((t) => [t.id, t])),
    [trattamenti],
  );
  const pianoMap = useMemo(
    () => new Map(piani.map((p) => [p.id, p])),
    [piani],
  );
  const voceMap = useMemo(() => new Map(voci.map((v) => [v.id, v])), [voci]);

  // arricchisci sedute con trattamento/piano/voce
  const righe: Riga[] = useMemo(
    () =>
      sedute.map((s) => ({
        ...s,
        trattamento: s.trattamento_id ? trattMap.get(s.trattamento_id) : undefined,
        piano: s.piano_id ? pianoMap.get(s.piano_id) : undefined,
        voce: s.voce_id ? voceMap.get(s.voce_id) : undefined,
        consensoOk: null,
        consensoMotivi: [],
      })),
    [sedute, trattMap, pianoMap, voceMap],
  );

  // Calcola consensi per le sedute non completate
  const [consensoMap, setConsensoMap] = useState<Map<string, { ok: boolean; motivi: string[] }>>(
    new Map(),
  );
  useEffect(() => {
    void (async () => {
      const map = new Map<string, { ok: boolean; motivi: string[] }>();
      const programmate = righe.filter((r) => !r.completata && r.trattamento_id);
      await Promise.all(
        programmate.map(async (r) => {
          const res = await puoEseguireTrattamento(pazienteId, r.trattamento_id!);
          map.set(r.id, { ok: res.ok, motivi: res.motivi });
        }),
      );
      setConsensoMap(map);
    })();
  }, [righe, pazienteId]);

  const programmate = righe
    .filter((r) => !r.completata)
    .sort((a, b) => {
      // "Da definire" in fondo
      if (!a.data_seduta && !b.data_seduta) return 0;
      if (!a.data_seduta) return 1;
      if (!b.data_seduta) return -1;
      return new Date(a.data_seduta).getTime() - new Date(b.data_seduta).getTime();
    });
  const eseguite = righe
    .filter((r) => r.completata)
    .sort((a, b) => {
      const da = dataClinica(a);
      const db = dataClinica(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return new Date(db).getTime() - new Date(da).getTime();
    });

  const inRitardo = programmate.filter((r) => statoSeduta(r) === "in_ritardo").length;
  const oggi = programmate.filter((r) => statoSeduta(r) === "oggi").length;
  const daDefinire = programmate.filter((r) => statoSeduta(r) === "da_definire").length;

  const visibili =
    filtro === "programmate"
      ? programmate
      : filtro === "eseguite"
        ? eseguite
        : [...programmate, ...eseguite];

  async function handleEsegui(s: Seduta) {
    const c = consensoMap.get(s.id);
    if (c && !c.ok && s.trattamento_id) {
      toast.error("Consenso mancante: firma prima di eseguire la seduta");
      return;
    }
    // Check baseline foto non bloccante
    if (s.piano_id) {
      const snoozeKey = `foto-baseline-snooze:${s.piano_id}`;
      const snoozeUntil = Number(localStorage.getItem(snoozeKey) || 0);
      if (snoozeUntil < Date.now()) {
        try {
          const stato = await getStatoPiano(s.piano_id);
          if (stato && stato.stato === "baseline_mancante") {
            setBaselineDialog({ seduta: s, incoerenza: stato.incoerenza_data });
            return;
          }
        } catch {
          // fail silent: non blocchiamo l'esecuzione per un errore foto
        }
      }
    }
    setEseguiSeduta(s);
  }

  async function handleFirmaConsenso(s: Seduta) {
    if (!s.trattamento_id) return;
    const session = await buildTrattamentoSession(pazienteId, [s.trattamento_id]);
    if (!session) {
      toast.success("Nessun consenso da firmare");
      return;
    }
    setFirmaSession(session);
    setPendingExecAfterFirma(null);
    setFirmaOpen(true);
  }

  return (
    <div className="space-y-4">
      {/* Card riepilogo */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              <span className="font-semibold">{eseguite.length}</span>
              <span className="text-muted-foreground">eseguite</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{programmate.length}</span>
              <span className="text-muted-foreground">programmate</span>
            </div>
            {inRitardo > 0 && (
              <Badge variant="destructive" className="gap-1">
                <Clock className="h-3 w-3" />
                {inRitardo} in ritardo
              </Badge>
            )}
            {oggi > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                {oggi} oggi
              </Badge>
            )}
            {daDefinire > 0 && (
              <Badge variant="outline" className="gap-1">
                <Calendar className="h-3 w-3" />
                {daDefinire} da pianificare
              </Badge>
            )}
          </div>
          <Button onClick={() => setSpotOpen(true)} size="sm">
            <Plus className="h-4 w-4" />
            Nuova seduta spot
          </Button>
        </CardContent>
      </Card>

      {/* Filtri */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Mostra:</span>
        <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutte ({righe.length})</SelectItem>
            <SelectItem value="programmate">Programmate ({programmate.length})</SelectItem>
            <SelectItem value="eseguite">Eseguite ({eseguite.length})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento sedute…</p>
      ) : visibili.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nessuna seduta da mostrare. Crea un piano o una seduta spot.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtro !== "eseguite" && programmate.length > 0 && (
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Programmate
            </h3>
          )}
          {visibili
            .filter((r) => !r.completata)
            .map((r) => (
              <SedutaCard
                key={r.id}
                seduta={r}
                consenso={consensoMap.get(r.id) ?? null}
                onEsegui={() => handleEsegui(r)}
                onFirmaConsenso={() => void handleFirmaConsenso(r)}
                onModifica={() => setModificaSeduta(r)}
                onAudit={() => setAuditSeduta(r)}
                onChanged={() => void load()}
                userId={user?.id}
                isMedico={hasRole("medico")}
              />
            ))}

          {filtro !== "programmate" && eseguite.length > 0 && (
            <h3 className="mt-4 font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Eseguite
            </h3>
          )}
          {visibili
            .filter((r) => r.completata)
            .map((r) => (
              <SedutaCard
                key={r.id}
                seduta={r}
                consenso={null}
                onEsegui={() => handleEsegui(r)}
                onFirmaConsenso={() => void handleFirmaConsenso(r)}
                onModifica={() => setModificaSeduta(r)}
                onAudit={() => setAuditSeduta(r)}
                onChanged={() => void load()}
                userId={user?.id}
                isMedico={hasRole("medico")}
              />
            ))}
        </div>
      )}

      {/* Dialog esecuzione (su seduta esistente programmata) */}
      {eseguiSeduta && (
        <EseguiSedutaDialog
          seduta={eseguiSeduta}
          trattamento={
            eseguiSeduta.trattamento_id
              ? trattMap.get(eseguiSeduta.trattamento_id)
              : undefined
          }
          voce={eseguiSeduta.voce_id ? voceMap.get(eseguiSeduta.voce_id) : undefined}
          onClose={() => setEseguiSeduta(null)}
          onSaved={() => {
            setEseguiSeduta(null);
            void load();
          }}
        />
      )}

      {/* Dialog modifica */}
      {modificaSeduta && (
        <ModificaSedutaDialog
          seduta={modificaSeduta}
          trattamento={
            modificaSeduta.trattamento_id
              ? trattMap.get(modificaSeduta.trattamento_id)
              : undefined
          }
          userId={user?.id}
          isMedico={hasRole("medico")}
          onClose={() => setModificaSeduta(null)}
          onSaved={() => {
            setModificaSeduta(null);
            void load();
          }}
        />
      )}

      {/* Nuova spot */}
      {spotOpen && (
        <NuovaSedutaSpotDialog
          pazienteId={pazienteId}
          trattamenti={trattamenti}
          onClose={() => setSpotOpen(false)}
          onSaved={() => {
            setSpotOpen(false);
            void load();
          }}
        />
      )}

      {/* Audit log */}
      {auditSeduta && (
        <AuditSedutaDialog
          sedutaId={auditSeduta.id}
          onClose={() => setAuditSeduta(null)}
        />
      )}

      <SignatureSessionDialog
        open={firmaOpen}
        session={firmaSession}
        onClose={() => {
          setFirmaOpen(false);
          setPendingExecAfterFirma(null);
        }}
        onCompleted={() => {
          setFirmaOpen(false);
          setPendingExecAfterFirma(null);
          void load();
          toast.success(
            "Consenso firmato. Puoi registrare la seduta quando vuoi.",
          );
        }}
      />
    </div>
  );
}

// ───────────────────────────── Card seduta ─────────────────────────────

function SedutaCard({
  seduta,
  consenso,
  onEsegui,
  onFirmaConsenso,
  onModifica,
  onAudit,
  onChanged,
  userId,
  isMedico,
}: {
  seduta: Riga;
  consenso: { ok: boolean; motivi: string[] } | null;
  onEsegui: () => void;
  onFirmaConsenso: () => void;
  onModifica: () => void;
  onAudit: () => void;
  onChanged: () => void;
  userId: string | undefined;
  isMedico: boolean;
}) {
  const stato: StatoSeduta = statoSeduta(seduta);
  const trattNome = seduta.trattamento?.nome ?? "Trattamento";
  const pianoNome = seduta.piano?.titolo ?? (seduta.piano_id ? "Piano" : "Spot");
  const dataEff = dataClinica(seduta);
  const dentro48h = entroFinestra48h(seduta);
  const permesso = valutaModificaSeduta(seduta, userId, isMedico);

  const [reschedOpen, setReschedOpen] = useState(false);

  async function annulla() {
    if (!confirm("Annullare questa seduta programmata?")) return;
    const { error } = await supabase.from("seduta").delete().eq("id", seduta.id);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    toast.success("Seduta annullata");
    onChanged();
  }

  return (
    <Card
      className={
        stato === "in_ritardo"
          ? "border-destructive/40"
          : stato === "oggi"
            ? "border-warning/40"
            : ""
      }
    >
      <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="flex-1 min-w-[240px] space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-semibold">{trattNome}</span>
            <span className="text-xs text-muted-foreground">
              {seduta.piano_id ? `· Piano "${pianoNome}"` : "· Seduta spot"}
            </span>
            {seduta.numero_seduta > 1 && (
              <Badge variant="outline" className="text-[10px]">
                #{seduta.numero_seduta}
              </Badge>
            )}
            <StatoBadge stato={stato} />
            {seduta.completata && !dentro48h && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Lock className="h-3 w-3" />
                Bloccata
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {seduta.completata
                ? `Eseguita: ${dataEff ? fmtData(dataEff) : "—"}`
                : seduta.data_seduta
                  ? `Prevista: ${fmtData(seduta.data_seduta)}`
                  : "Data da definire"}
            </span>
            {seduta.completata && dataEff &&
              new Date(seduta.data_registrazione).toDateString() !==
                new Date(dataEff).toDateString() && (
                <span className="italic">
                  (registrata {fmtData(seduta.data_registrazione)})
                </span>
              )}
            {seduta.voce?.zone && seduta.voce.zone.length > 0 && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {seduta.voce.zone.join(", ")}
              </span>
            )}
            {seduta.prodotti_previsti.length > 0 && (
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {formatProdotti(seduta.prodotti_previsti)}
              </span>
            )}
          </div>

          {seduta.note_cliniche && seduta.completata && (
            <p className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">
              {seduta.note_cliniche}
            </p>
          )}

          {consenso && !consenso.ok && (
            <Alert variant="destructive" className="mt-2 py-2">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle className="text-xs">Consenso mancante</AlertTitle>
              <AlertDescription className="text-xs">
                {consenso.motivi.join(" · ")}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!seduta.completata && (
            <>
              {consenso && !consenso.ok ? (
                <Button size="sm" variant="default" onClick={onFirmaConsenso}>
                  <FileSignature className="h-4 w-4" />
                  Firma consenso
                </Button>
              ) : (
                <Button size="sm" onClick={onEsegui}>
                  <CheckCircle2 className="h-4 w-4" />
                  Esegui
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReschedOpen((v) => !v)}
              >
                <Calendar className="h-4 w-4" />
                Sposta
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void annulla()}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
          {seduta.completata && (
            <>
              {permesso.puoModificare && (
                <Button size="sm" variant="outline" onClick={onModifica}>
                  <Pencil className="h-4 w-4" />
                  Modifica
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={onAudit}>
                <History className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {reschedOpen && !seduta.completata && (
          <RescheduleInline
            seduta={seduta}
            onDone={() => {
              setReschedOpen(false);
              onChanged();
            }}
            onCancel={() => setReschedOpen(false)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function StatoBadge({ stato }: { stato: StatoSeduta }) {
  if (stato === "eseguita")
    return (
      <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Eseguita
      </Badge>
    );
  if (stato === "in_ritardo")
    return (
      <Badge variant="destructive" className="gap-1 text-[10px]">
        <Clock className="h-3 w-3" />
        In ritardo
      </Badge>
    );
  if (stato === "oggi")
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Clock className="h-3 w-3" />
        Oggi
      </Badge>
    );
  if (stato === "da_definire")
    return (
      <Badge variant="outline" className="gap-1 text-[10px] border-muted-foreground/40 text-muted-foreground">
        <Calendar className="h-3 w-3" />
        Da pianificare
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 text-[10px]">
      <Calendar className="h-3 w-3" />
      Programmata
    </Badge>
  );
}

function RescheduleInline({
  seduta,
  onDone,
  onCancel,
}: {
  seduta: Seduta;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(
    toLocalInput(seduta.data_seduta ?? new Date().toISOString()),
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("seduta")
      .update({ data_seduta: new Date(val).toISOString() })
      .eq("id", seduta.id);
    setSaving(false);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    toast.success("Data aggiornata");
    onDone();
  }

  return (
    <div className="mt-2 flex w-full items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
      <Input
        type="datetime-local"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="h-8 flex-1"
      />
      <Button size="sm" onClick={() => void save()} disabled={saving}>
        Salva
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ───────────────────────────── Dialog: Esegui seduta ─────────────────────────────

function EseguiSedutaDialog({
  seduta,
  trattamento,
  voce,
  onClose,
  onSaved,
}: {
  seduta: Seduta;
  trattamento?: Trattamento;
  voce?: PianoVoce;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [dataEsecuzione, setDataEsecuzione] = useState(
    toLocalInput(seduta.data_esecuzione_effettiva ?? new Date().toISOString()),
  );
  const [durata, setDurata] = useState<string>(
    seduta.durata_minuti?.toString() ?? trattamento?.durata_minuti?.toString() ?? "",
  );
  const [zone, setZone] = useState<string[]>(voce?.zone ?? []);
  const [zoneDraft, setZoneDraft] = useState("");
  const [prodotti, setProdotti] = useState<ProdottoPrevisto[]>(
    seduta.prodotti_previsti.length > 0 ? seduta.prodotti_previsti : voce?.prodotti_previsti ?? [],
  );
  const [parametri, setParametri] = useState<string>(
    typeof seduta.parametri_tecnici === "object" && seduta.parametri_tecnici
      ? JSON.stringify(seduta.parametri_tecnici, null, 2).replace(/^{}\s*$/, "")
      : "",
  );
  const [note, setNote] = useState(seduta.note_cliniche ?? "");
  const [consumoRighe, setConsumoRighe] = useState<ConsumoRiga[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleZona(z: string) {
    setZone((prev) => (prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]));
  }
  function addZonaDraft() {
    const v = zoneDraft.trim();
    if (!v) return;
    if (!zone.includes(v)) setZone([...zone, v]);
    setZoneDraft("");
  }

  function addProdotto() {
    setProdotti((prev) => [...prev, { nome: "", quantita: 1 }]);
  }
  function updateProdotto(i: number, patch: Partial<ProdottoPrevisto>) {
    setProdotti((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function removeProdotto(i: number) {
    setProdotti((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function salva() {
    setSaving(true);
    let parametriObj: Record<string, unknown> = {};
    if (parametri.trim()) {
      try {
        parametriObj = JSON.parse(parametri);
      } catch {
        parametriObj = { note: parametri };
      }
    }

    const dataIso = new Date(dataEsecuzione).toISOString();
    const { error } = await supabase
      .from("seduta")
      .update({
        completata: true,
        data_esecuzione_effettiva: dataIso,
        data_registrazione: new Date().toISOString(),
        durata_minuti: durata ? Number(durata) : null,
        operatore_id: user?.id ?? null,
        firmata_da: user?.id ?? null,
        // firmata_il viene impostato dal trigger
        prodotti_previsti: prodotti.filter((p) => p.nome.trim()) as never,
        parametri_tecnici: parametriObj as never,
        note_cliniche: note.trim() || null,
      })
      .eq("id", seduta.id);

    setSaving(false);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }

    // Scarico magazzino (best-effort, non blocca firma)
    const righe = righeToRigheConsumo(consumoRighe);
    if (righe.length > 0) {
      try {
        const res = await consumaSeduta(seduta.id, righe);
        if (res.warnings && res.warnings.length > 0) {
          toast.warning(`Magazzino: ${res.warnings.join("; ")}`);
        }
      } catch (e) {
        toast.error(`Magazzino non aggiornato: ${(e as Error).message}`);
      }
    }

    toast.success("Seduta firmata e aggiunta al diario");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Esegui seduta · {trattamento?.nome ?? "Trattamento"}</DialogTitle>
          <DialogDescription>
            Compila l'esecuzione clinica reale. La voce verrà aggiunta automaticamente al diario.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Data esecuzione *</Label>
              <Input
                type="datetime-local"
                value={dataEsecuzione}
                onChange={(e) => setDataEsecuzione(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Inserisci una data passata se stai registrando a posteriori. La data di
                inserimento ({fmtDataOra(new Date().toISOString())}) verrà comunque registrata.
              </p>
            </div>
            <div>
              <Label>Durata (minuti)</Label>
              <Input
                type="number"
                min={0}
                value={durata}
                onChange={(e) => setDurata(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Zone trattate</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ZONE_PREDEFINITE.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => toggleZona(z)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${
                    zone.includes(z)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Zona personalizzata"
                value={zoneDraft}
                onChange={(e) => setZoneDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addZonaDraft())}
                className="h-8"
              />
              <Button type="button" variant="outline" size="sm" onClick={addZonaDraft}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {zone.filter((z) => !ZONE_PREDEFINITE.includes(z)).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {zone
                  .filter((z) => !ZONE_PREDEFINITE.includes(z))
                  .map((z) => (
                    <Badge key={z} variant="secondary" className="gap-1">
                      {z}
                      <button onClick={() => toggleZona(z)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Prodotti utilizzati</Label>
              <Button type="button" size="sm" variant="outline" onClick={addProdotto}>
                <Plus className="h-4 w-4" />
                Aggiungi
              </Button>
            </div>
            <div className="mt-2 space-y-2">
              {prodotti.length === 0 && (
                <p className="text-xs text-muted-foreground">Nessun prodotto.</p>
              )}
              {prodotti.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Select
                    value={p.nome}
                    onValueChange={(v) => updateProdotto(i, { nome: v })}
                  >
                    <SelectTrigger className="h-9 flex-1">
                      <SelectValue placeholder="Seleziona prodotto" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODOTTI_DEMO.map((pd) => (
                        <SelectItem key={pd.id} value={pd.nome}>
                          {pd.nome}
                        </SelectItem>
                      ))}
                      {p.nome && !PRODOTTI_DEMO.some((pd) => pd.nome === p.nome) && (
                        <SelectItem value={p.nome}>{p.nome}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={p.quantita}
                    onChange={(e) =>
                      updateProdotto(i, { quantita: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
                    }
                    className="h-9 w-20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeProdotto(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <ConsumoMagazzinoStep righe={consumoRighe} onChange={setConsumoRighe} />

          <div>
            <Label>Parametri tecnici (opzionale)</Label>
            <Textarea
              rows={2}
              value={parametri}
              onChange={(e) => setParametri(e.target.value)}
              placeholder="Es. profondità ago 4mm, frequenza 5Hz, energia 12J"
            />
          </div>

          <div>
            <Label>Note cliniche</Label>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tolleranza, reazioni, indicazioni post"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={() => void salva()} disabled={saving}>
            <CheckCircle2 className="h-4 w-4" />
            Firma e completa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── Dialog: Modifica seduta firmata ─────────────────────────────

function ModificaSedutaDialog({
  seduta,
  trattamento,
  userId,
  isMedico,
  onClose,
  onSaved,
}: {
  seduta: Seduta;
  trattamento?: Trattamento;
  userId: string | undefined;
  isMedico: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const permesso = valutaModificaSeduta(seduta, userId, isMedico);

  const [dataEsecuzione, setDataEsecuzione] = useState(
    toLocalInput(
      seduta.data_esecuzione_effettiva ?? seduta.data_seduta ?? new Date().toISOString(),
    ),
  );
  const [durata, setDurata] = useState<string>(seduta.durata_minuti?.toString() ?? "");
  const [prodotti, setProdotti] = useState<ProdottoPrevisto[]>(seduta.prodotti_previsti);
  const [note, setNote] = useState(seduta.note_cliniche ?? "");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  function addProdotto() {
    setProdotti((p) => [...p, { nome: "", quantita: 1 }]);
  }

  async function salva() {
    if (!userId) return;
    if (permesso.motivoObbligatorio && !motivo.trim()) {
      toast.error("Motivo obbligatorio per modifiche oltre 48h");
      return;
    }
    setSaving(true);
    const dataIso = new Date(dataEsecuzione).toISOString();
    const newValues = {
      data_esecuzione_effettiva: dataIso,
      durata_minuti: durata ? Number(durata) : null,
      prodotti_previsti: prodotti.filter((p) => p.nome.trim()),
      note_cliniche: note.trim() || null,
    };
    const oldValues = {
      data_esecuzione_effettiva: seduta.data_esecuzione_effettiva,
      durata_minuti: seduta.durata_minuti,
      prodotti_previsti: seduta.prodotti_previsti,
      note_cliniche: seduta.note_cliniche,
    };
    const delta = diffPerAudit(oldValues, newValues, [
      "data_esecuzione_effettiva",
      "durata_minuti",
      "prodotti_previsti",
      "note_cliniche",
    ]);

    if (delta.length === 0) {
      toast.info("Nessuna modifica");
      setSaving(false);
      onClose();
      return;
    }

    const { error } = await supabase
      .from("seduta")
      .update({
        data_esecuzione_effettiva: newValues.data_esecuzione_effettiva,
        durata_minuti: newValues.durata_minuti,
        prodotti_previsti: newValues.prodotti_previsti as never,
        note_cliniche: newValues.note_cliniche,
      })
      .eq("id", seduta.id);

    if (error) {
      setSaving(false);
      toast.error(`Errore: ${error.message}`);
      return;
    }

    await registraModificheSeduta(
      seduta.id,
      userId,
      delta,
      permesso.motivoObbligatorio ? motivo.trim() : null,
      permesso.motivoObbligatorio,
    );

    setSaving(false);
    toast.success(
      permesso.motivoObbligatorio
        ? "Modifica registrata nell'audit"
        : "Seduta aggiornata",
    );
    onSaved();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica seduta · {trattamento?.nome ?? "Trattamento"}</DialogTitle>
          <DialogDescription>
            Firmata il {seduta.firmata_il ? fmtDataOra(seduta.firmata_il) : "—"}
          </DialogDescription>
        </DialogHeader>

        {permesso.motivoObbligatorio && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Modifica oltre 48h</AlertTitle>
            <AlertDescription>{permesso.motivo}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Data esecuzione</Label>
              <Input
                type="datetime-local"
                value={dataEsecuzione}
                onChange={(e) => setDataEsecuzione(e.target.value)}
              />
            </div>
            <div>
              <Label>Durata (minuti)</Label>
              <Input
                type="number"
                min={0}
                value={durata}
                onChange={(e) => setDurata(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Prodotti utilizzati</Label>
              <Button type="button" size="sm" variant="outline" onClick={addProdotto}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 space-y-2">
              {prodotti.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <Select
                    value={p.nome}
                    onValueChange={(v) =>
                      setProdotti((arr) =>
                        arr.map((x, idx) => (idx === i ? { ...x, nome: v } : x)),
                      )
                    }
                  >
                    <SelectTrigger className="h-9 flex-1">
                      <SelectValue placeholder="Prodotto" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODOTTI_DEMO.map((pd) => (
                        <SelectItem key={pd.id} value={pd.nome}>
                          {pd.nome}
                        </SelectItem>
                      ))}
                      {p.nome && !PRODOTTI_DEMO.some((pd) => pd.nome === p.nome) && (
                        <SelectItem value={p.nome}>{p.nome}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    value={p.quantita}
                    onChange={(e) =>
                      setProdotti((arr) =>
                        arr.map((x, idx) =>
                          idx === i
                            ? { ...x, quantita: Math.max(1, Math.floor(Number(e.target.value) || 1)) }
                            : x,
                        ),
                      )
                    }
                    className="h-9 w-20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setProdotti((arr) => arr.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Note cliniche</Label>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {permesso.motivoObbligatorio && (
            <div>
              <Label>
                Motivo della modifica <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Es. correzione quantità prodotto su segnalazione paziente"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Verrà registrato permanentemente nell'audit con timestamp e tuo identificativo.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={() => void salva()} disabled={saving}>
            Salva modifiche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── Dialog: Nuova seduta spot ─────────────────────────────

function NuovaSedutaSpotDialog({
  pazienteId,
  trattamenti,
  onClose,
  onSaved,
}: {
  pazienteId: string;
  trattamenti: Trattamento[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [trattamentoId, setTrattamentoId] = useState<string>("");
  const [data, setData] = useState(toLocalInput(new Date().toISOString()));
  const [completaSubito, setCompletaSubito] = useState(true);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [consensoOk, setConsensoOk] = useState<boolean | null>(null);
  const [consensoMotivi, setConsensoMotivi] = useState<string[]>([]);

  useEffect(() => {
    if (!trattamentoId) {
      setConsensoOk(null);
      return;
    }
    void puoEseguireTrattamento(pazienteId, trattamentoId).then((r) => {
      setConsensoOk(r.ok);
      setConsensoMotivi(r.motivi);
    });
  }, [trattamentoId, pazienteId]);

  async function salva() {
    if (!trattamentoId) {
      toast.error("Seleziona un trattamento");
      return;
    }
    if (completaSubito && consensoOk === false) {
      toast.error("Consenso mancante: impossibile firmare");
      return;
    }
    setSaving(true);
    const dataIso = new Date(data).toISOString();
    const { error } = await supabase.from("seduta").insert({
      paziente_id: pazienteId,
      piano_id: null,
      trattamento_id: trattamentoId,
      numero_seduta: 1,
      data_seduta: dataIso,
      data_esecuzione_effettiva: completaSubito ? dataIso : null,
      data_registrazione: new Date().toISOString(),
      operatore_id: completaSubito ? user?.id ?? null : null,
      firmata_da: completaSubito ? user?.id ?? null : null,
      completata: completaSubito,
      note_cliniche: note.trim() || null,
      prodotti_previsti: [] as never,
      parametri_tecnici: {} as never,
    });
    setSaving(false);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    toast.success(completaSubito ? "Seduta spot registrata" : "Seduta spot programmata");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuova seduta spot</DialogTitle>
          <DialogDescription>
            Seduta non legata a un piano (es. ritocco, consulto, urgenza).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Trattamento *</Label>
            <Select value={trattamentoId} onValueChange={setTrattamentoId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona trattamento" />
              </SelectTrigger>
              <SelectContent>
                {trattamenti
                  .filter((t) => t.attivo)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Data</Label>
            <Input
              type="datetime-local"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={completaSubito}
              onChange={(e) => setCompletaSubito(e.target.checked)}
            />
            Firma e completa subito (altrimenti viene programmata)
          </label>

          <div>
            <Label>Note cliniche</Label>
            <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {consensoOk === false && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Consenso mancante</AlertTitle>
              <AlertDescription className="text-xs">
                {consensoMotivi.join(" · ")}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={() => void salva()} disabled={saving}>
            {completaSubito ? "Firma e completa" : "Programma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────────── Dialog: Audit log seduta ─────────────────────────────

function AuditSedutaDialog({
  sedutaId,
  onClose,
}: {
  sedutaId: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<SedutaModifica[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("seduta_modifica")
        .select("*")
        .eq("seduta_id", sedutaId)
        .order("modificata_il", { ascending: false });
      setRows((data ?? []) as unknown as SedutaModifica[]);
      setLoading(false);
    })();
  }, [sedutaId]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Storico modifiche</DialogTitle>
          <DialogDescription>
            Audit log immutabile delle modifiche a questa seduta.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessuna modifica registrata.</p>
        ) : (
          <ol className="space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.campo}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmtDataOra(r.modificata_il)}
                  </span>
                </div>
                {r.oltre_48h && (
                  <Badge variant="destructive" className="mt-1 text-[10px]">
                    Oltre 48h
                  </Badge>
                )}
                <div className="mt-2 grid gap-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Prima:</span>{" "}
                    <code className="rounded bg-muted px-1">
                      {JSON.stringify(r.valore_precedente)}
                    </code>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dopo:</span>{" "}
                    <code className="rounded bg-muted px-1">
                      {JSON.stringify(r.valore_nuovo)}
                    </code>
                  </div>
                </div>
                {r.motivo && (
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    Motivo: {r.motivo}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
