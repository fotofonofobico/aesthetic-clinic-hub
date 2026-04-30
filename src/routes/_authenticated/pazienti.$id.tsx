import { createFileRoute, Outlet, useNavigate, useMatches, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, ArrowLeft, Download, FileSignature, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SeverityBadge } from "./pazienti.index";
import type { Paziente, PazienteAlert, FlagRischio, AlertSeverity } from "@/types/clinico";
import { ConsensiPanel } from "@/components/paziente/consensi-panel";
import { PianiPanel } from "@/components/paziente/piani-panel";
import { DiarioPanel } from "@/components/paziente/diario-panel";
import { SedutePanel } from "@/components/paziente/sedute-panel";
import { AnamnesiPanel } from "@/components/paziente/anamnesi-panel";
import { evaluateAccess, puoEseguireTrattamento, type AccessEvaluation } from "@/lib/access-guard";
import { FotoPazienteTab } from "@/components/foto/foto-paziente-tab";
import { FotoBaselineBanner } from "@/components/foto/foto-baseline-banner";
import { generaPdfCartellaPaziente } from "@/lib/pdf-cartella-paziente";

export const Route = createFileRoute("/_authenticated/pazienti/$id")({
  component: PazienteDetailPage,
  errorComponent: PazienteErrorComponent,
});

function PazienteErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-lg border-2 border-destructive/40 bg-destructive/10 p-6">
      <h2 className="font-display text-lg font-semibold text-destructive">
        Si è verificato un errore caricando questa scheda
      </h2>
      <p className="text-sm text-muted-foreground">
        {error?.message ?? "Errore sconosciuto"}
      </p>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            void router.invalidate();
            reset();
          }}
        >
          Riprova
        </Button>
      </div>
    </div>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function PazienteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const matches = useMatches();
  const isChildRoute = matches.some(
    (m) => m.routeId !== Route.id && m.routeId.startsWith(Route.id),
  );

  const [paziente, setPaziente] = useState<Paziente | null>(null);
  const [alerts, setAlerts] = useState<PazienteAlert[]>([]);
  const [flags, setFlags] = useState<FlagRischio[]>([]);
  const [access, setAccess] = useState<AccessEvaluation | null>(null);
  const [consensiPianoMancanti, setConsensiPianoMancanti] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("diario");
  const [exportingPdf, setExportingPdf] = useState(false);

  async function esportaCartella() {
    if (!paziente) return;
    setExportingPdf(true);
    try {
      const { blob, filename } = await generaPdfCartellaPaziente(paziente.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Cartella PDF generata");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore generazione PDF";
      toast.error(msg);
    } finally {
      setExportingPdf(false);
    }
  }

  useEffect(() => {
    if (isChildRoute) {
      setLoading(false);
      return;
    }
    if (!UUID_RE.test(id)) {
      toast.error("Paziente non trovato");
      void navigate({ to: "/pazienti" });
      return;
    }
    void load();
  }, [id, isChildRoute]);

  async function load(opts: { silent?: boolean } = {}) {
    if (!opts.silent) setLoading(true);
    const [pRes, aRes, fRes] = await Promise.all([
      supabase.from("pazienti").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("paziente_alert")
        .select("*")
        .eq("paziente_id", id)
        .eq("attivo", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("anamnesi_flag_rischio")
        .select("*")
        .eq("paziente_id", id)
        .order("severity", { ascending: false }),
    ]);

    if (pRes.error || !pRes.data) {
      toast.error("Paziente non trovato");
      void navigate({ to: "/pazienti" });
      return;
    }
    setPaziente(pRes.data as Paziente);
    setAlerts((aRes.data ?? []) as PazienteAlert[]);
    setFlags((fRes.data ?? []) as FlagRischio[]);

    // Valuta stato consensi/anamnesi (non bloccante per il rendering)
    void evaluateAccess(id).then(setAccess).catch(() => setAccess(null));

    // Consensi mancanti per voci di piani non annullati
    void (async () => {
      try {
        const { data: piani } = await supabase
          .from("piano_trattamento")
          .select("id, stato")
          .eq("paziente_id", id)
          .neq("stato", "annullato");
        const ids = (piani ?? []).map((p) => (p as { id: string }).id);
        if (ids.length === 0) {
          setConsensiPianoMancanti([]);
          return;
        }
        const { data: voci } = await supabase
          .from("piano_trattamento_voce")
          .select("trattamento_id")
          .in("piano_id", ids);
        const trattIds = Array.from(
          new Set(
            (voci ?? [])
              .map((v) => (v as { trattamento_id: string | null }).trattamento_id)
              .filter((x): x is string => !!x),
          ),
        );
        if (trattIds.length === 0) {
          setConsensiPianoMancanti([]);
          return;
        }
        const { data: trattRows } = await supabase
          .from("trattamenti")
          .select("id, nome")
          .in("id", trattIds);
        const nameMap = new Map<string, string>(
          (trattRows ?? []).map((t) => [
            (t as { id: string }).id,
            (t as { nome: string }).nome,
          ]),
        );
        const mancanti: string[] = [];
        await Promise.all(
          trattIds.map(async (tid) => {
            const res = await puoEseguireTrattamento(id, tid);
            if (!res.ok) mancanti.push(nameMap.get(tid) ?? "Trattamento");
          }),
        );
        setConsensiPianoMancanti(mancanti.sort());
      } catch {
        setConsensiPianoMancanti([]);
      }
    })();

    if (user?.id) {
      void supabase
        .from("paziente_access_log")
        .insert({ paziente_id: id, user_id: user.id, azione: "view" });
    }

    setLoading(false);
  }

  if (isChildRoute) return <Outlet />;
  if (loading || !paziente) {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  }

  const eta = paziente.data_nascita
    ? Math.floor(
        (Date.now() - new Date(paziente.data_nascita).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-3 sm:space-y-6 sm:px-4 lg:px-0">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/pazienti" })}>
          <ArrowLeft className="h-4 w-4" />
          Lista pazienti
        </Button>
      </div>

      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {paziente.cognome} {paziente.nome}
          </h1>
          <p className="text-sm text-muted-foreground">
            {paziente.data_nascita
              ? `${formatDate(paziente.data_nascita)}${eta !== null ? ` · ${eta} anni` : ""}`
              : "Data di nascita non indicata"}
            {paziente.sesso ? ` · ${paziente.sesso}` : ""}
            {paziente.codice_fiscale ? ` · ${paziente.codice_fiscale}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void esportaCartella()}
            disabled={exportingPdf}
          >
            <Download className="h-4 w-4" />
            {exportingPdf ? "Generazione…" : "Esporta cartella PDF"}
          </Button>
        </div>
      </header>

      {/* Banner flag/alert critici sempre in evidenza */}
      <CriticalBanner
        flags={flags}
        alerts={alerts}
        access={access}
        consensiPianoMancanti={consensiPianoMancanti}
      />

      <FotoBaselineBanner paziente_id={id} onClickPiano={() => setTab("foto")} />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="max-w-full justify-start overflow-x-auto whitespace-nowrap">
          <TabsTrigger value="diario">Diario</TabsTrigger>
          <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
          <TabsTrigger value="anamnesi">Anamnesi</TabsTrigger>
          <TabsTrigger value="piani">Piani</TabsTrigger>
          <TabsTrigger value="sedute">Sedute</TabsTrigger>
          <TabsTrigger value="foto">Foto</TabsTrigger>
          <TabsTrigger value="consensi">Consensi</TabsTrigger>
          <TabsTrigger value="alert">Alert ({flags.length + alerts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="diario">
          <DiarioPanel pazienteId={id} />
        </TabsContent>

        <TabsContent value="anagrafica">
          <AnagraficaPanel
            paziente={paziente}
            onEdit={() => navigate({ to: "/pazienti/$id/edit", params: { id } })}
          />
        </TabsContent>

        <TabsContent value="anamnesi">
          <AnamnesiPanel
            pazienteId={id}
            pazienteNome={`${paziente.nome} ${paziente.cognome}`}
            sesso={paziente.sesso}
            onSaved={() => void load({ silent: true })}
          />
        </TabsContent>

        <TabsContent value="piani">
          <PianiPanel
            pazienteId={id}
            pazienteNome={`${paziente.nome} ${paziente.cognome}`}
            onChanged={() => void load({ silent: true })}
          />
        </TabsContent>

        <TabsContent value="sedute">
          <SedutePanel
            pazienteId={id}
            pazienteNome={`${paziente.nome} ${paziente.cognome}`}
            onChanged={() => void load({ silent: true })}
          />
        </TabsContent>

        <TabsContent value="foto">
          <FotoPazienteTab paziente_id={id} />
        </TabsContent>

        <TabsContent value="consensi">
          <ConsensiPanel
            pazienteId={id}
            pazienteNome={`${paziente.nome} ${paziente.cognome}`}
            onChanged={() => void load({ silent: true })}
          />
        </TabsContent>

        <TabsContent value="alert">
          <AlertPanel
            pazienteId={id}
            alerts={alerts}
            flags={flags}
            onChanged={() => void load({ silent: true })}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CriticalBanner({
  flags,
  alerts,
  access,
  consensiPianoMancanti,
}: {
  flags: FlagRischio[];
  alerts: PazienteAlert[];
  access: AccessEvaluation | null;
  consensiPianoMancanti: string[];
}) {
  const critici = [
    ...flags.filter((f) => f.severity === "critico").map((f) => f.etichetta),
    ...alerts.filter((a) => a.severity === "critico").map((a) => a.testo),
  ];
  const blocchi = access ? access.motivi : [];
  const haBlocco = !!access && (access.bloccoTotale || access.bloccoTrattamenti);

  const showObsoletaWarning =
    !!access &&
    access.anamnesiObsoleta &&
    !access.bloccoTotale &&
    !access.bloccoTrattamenti;

  if (
    critici.length === 0 &&
    blocchi.length === 0 &&
    !showObsoletaWarning &&
    consensiPianoMancanti.length === 0
  )
    return null;

  return (
    <div className="space-y-2">
      {critici.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border-2 border-destructive/40 bg-destructive/10 p-4 text-sm shadow-sm">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <div className="font-semibold text-destructive">Attenzione clinica</div>
            <div className="mt-0.5 text-foreground">{critici.join(" · ")}</div>
          </div>
        </div>
      )}
      {consensiPianoMancanti.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border-2 border-warning/40 bg-warning/10 p-4 text-sm shadow-sm">
          <FileSignature className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <div className="font-semibold">
              Consenso mancante per {consensiPianoMancanti.length} trattamento/i nei piani
            </div>
            <div className="mt-0.5 text-foreground">
              {consensiPianoMancanti.join(" · ")}. Firma prima di iniziare le sedute.
            </div>
          </div>
        </div>
      )}
      {blocchi.length > 0 && (
        <div
          className={`flex items-start gap-3 rounded-lg border-2 p-4 text-sm shadow-sm ${
            haBlocco
              ? "border-destructive/40 bg-destructive/10"
              : "border-warning/40 bg-warning/10"
          }`}
        >
          <ShieldAlert
            className={`mt-0.5 h-5 w-5 shrink-0 ${
              haBlocco ? "text-destructive" : "text-warning"
            }`}
          />
          <div>
            <div className={`font-semibold ${haBlocco ? "text-destructive" : ""}`}>
              {haBlocco ? "Trattamenti bloccati" : "Avvisi consensi"}
            </div>
            <div className="mt-0.5 text-foreground">{blocchi.join(" · ")}</div>
          </div>
        </div>
      )}
      {showObsoletaWarning && (
        <div className="flex items-start gap-3 rounded-lg border-2 border-warning/40 bg-warning/10 p-4 text-sm shadow-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <div className="font-semibold">Anamnesi: nuova versione in lavorazione</div>
            <div className="mt-0.5 text-foreground">
              È presente una nuova anamnesi non firmata. Stai operando su una versione precedente.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnagraficaPanel({ paziente, onEdit }: { paziente: Paziente; onEdit: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="font-display text-base">Anagrafica</CardTitle>
        <Button variant="outline" size="sm" onClick={onEdit} className="w-full sm:w-auto">
          <Pencil className="h-4 w-4" />
          Modifica anagrafica
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 p-6 md:grid-cols-2">
        <Info label="Telefono" value={paziente.telefono} />
        <Info label="Email" value={paziente.email} />
        <Info
          label="Indirizzo"
          value={
            [
              paziente.indirizzo,
              [paziente.cap, paziente.citta].filter(Boolean).join(" "),
              paziente.provincia,
            ]
              .filter(Boolean)
              .join(", ") || null
          }
        />
        <Info label="Luogo di nascita" value={paziente.luogo_nascita} />
        <Info label="Professione" value={paziente.professione} />
        <Info label="Codice fiscale" value={paziente.codice_fiscale} mono />
        {paziente.note ? (
          <div className="md:col-span-2">
            <Info label="Note" value={paziente.note} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

function AlertPanel({
  pazienteId,
  alerts,
  flags,
  onChanged,
}: {
  pazienteId: string;
  alerts: PazienteAlert[];
  flags: FlagRischio[];
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [testo, setTesto] = useState("");
  const [severity, setSeverity] = useState<AlertSeverity>("attenzione");

  async function add() {
    if (!testo.trim()) return;
    const { error } = await supabase.from("paziente_alert").insert({
      paziente_id: pazienteId,
      testo: testo.trim(),
      severity,
      created_by: user?.id,
    });
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    setTesto("");
    setSeverity("attenzione");
    toast.success("Alert aggiunto");
    onChanged();
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("paziente_alert")
      .update({ attivo: false })
      .eq("id", id);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    onChanged();
  }

  return (
    <div className="space-y-4">
      {/* Flag automatici da anamnesi (sola lettura) */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">
            Flag automatici da anamnesi ({flags.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {flags.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessun flag automatico. Vengono generati compilando l'anamnesi.
            </p>
          ) : (
            <div className="space-y-2">
              {flags.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-3">
                    <SeverityBadge severity={f.severity} />
                    <span className="text-sm">{f.etichetta}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">da anamnesi</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Aggiungi alert manuale</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div className="space-y-2">
              <Label>Testo</Label>
              <Input
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                placeholder="Es. Non utilizzare prodotti con nichel"
              />
            </div>
            <div className="space-y-2">
              <Label>Severità</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as AlertSeverity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="attenzione">Attenzione</SelectItem>
                  <SelectItem value="critico">Critico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={add} disabled={!testo.trim()}>
              <Plus className="h-4 w-4" />
              Aggiungi alert
            </Button>
          </div>
        </CardContent>
      </Card>

      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun alert manuale attivo.</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <SeverityBadge severity={a.severity} />
                <span className="text-sm">{a.testo}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void remove(a.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT");
}
