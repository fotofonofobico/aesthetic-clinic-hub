import { useEffect, useState } from "react";
import { confirmDialog } from "@/lib/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  AlertCircle,
  CalendarPlus,
  ClipboardList,
  FileSignature,
  MessageCircle,
  Paperclip,
  Pencil,
  Phone,
  Plus,
  Printer,
  ShieldAlert,
  StickyNote,
  Stethoscope,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { NotaAllegato, NotaTipo, Paziente, PazienteNota } from "@/types/clinico";
import { loadStudioForPdf } from "@/lib/pdf-studio-loader";
import { generaPdfRelazione } from "@/lib/pdf-relazione";
import { printBlob } from "@/lib/download";
import { useProfile, nomeVisualizzato } from "@/hooks/use-profile";

interface TimelineEvent {
  id: string;
  ts: string;
  kind:
    | "paziente_creato"
    | "anamnesi"
    | "flag"
    | "alert"
    | "piano"
    | "seduta"
    | "followup"
    | "complicanza"
    | "consenso"
    | "audit"
    | "nota";
  title: string;
  detail?: string;
  severity?: "info" | "attenzione" | "critico";
  notaTipo?: NotaTipo;
  allegati?: NotaAllegato[];
}

const TIPO_LABEL: Record<NotaTipo, string> = {
  clinica: "Nota clinica",
  telefonata: "Telefonata",
  promemoria: "Promemoria",
  altro: "Altro",
};

export function DiarioPanel({ pazienteId }: { pazienteId: string }) {
  const { user, hasRole } = useAuth();
  const { data: profilo } = useProfile();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [notes, setNotes] = useState<PazienteNota[]>([]);
  const [paziente, setPaziente] = useState<Paziente | null>(null);
  const [loading, setLoading] = useState(true);

  // form nuova nota
  const [tipo, setTipo] = useState<NotaTipo>("clinica");
  const [testo, setTesto] = useState("");
  const nowLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const [dataEvento, setDataEvento] = useState<string>(() => nowLocal());
  const [dataEventoTouched, setDataEventoTouched] = useState(false);
  const [aggiungiAlCalendario, setAggiungiAlCalendario] = useState(false);
  const [filtro, setFiltro] = useState<string>("tutti");
  const [allegatiFile, setAllegatiFile] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void load();
  }, [pazienteId]);

  async function load() {
    setLoading(true);
    const [pRes, anRes, fRes, alRes, plRes, sdRes, fuRes, cnRes, ntRes, auRes, avRes] =
      await Promise.all([
        supabase.from("pazienti").select("*").eq("id", pazienteId).maybeSingle(),
        supabase
          .from("anamnesi")
          .select("updated_at, created_at")
          .eq("paziente_id", pazienteId)
          .maybeSingle(),
        supabase
          .from("anamnesi_flag_rischio")
          .select("id, etichetta, severity, origine, created_at")
          .eq("paziente_id", pazienteId),
        supabase
          .from("paziente_alert")
          .select("id, testo, severity, created_at, attivo")
          .eq("paziente_id", pazienteId),
        supabase
          .from("piano_trattamento")
          .select("id, titolo, stato, created_at")
          .eq("paziente_id", pazienteId),
        supabase
          .from("seduta")
          .select("id, numero_seduta, data_seduta, completata, note_cliniche")
          .eq("paziente_id", pazienteId),
        supabase
          .from("followup")
          .select(
            "id, data_followup, esito, note, complicanza_segnalata, complicanza_descrizione",
          )
          .eq("paziente_id", pazienteId),
        supabase
          .from("consenso_firmato")
          .select("id, titolo_snapshot, firmato_il")
          .eq("paziente_id", pazienteId),
        supabase
          .from("paziente_nota")
          .select("*")
          .eq("paziente_id", pazienteId)
          .order("data_evento", { ascending: false }),
        supabase
          .from("audit_log")
          .select("id, action, entity_type, metadata, created_at")
          .eq("entity_type", "paziente")
          .eq("entity_id", pazienteId)
          .order("created_at", { ascending: false }),
        supabase
          .from("anamnesi_versione")
          .select("id, created_at")
          .eq("paziente_id", pazienteId)
          .order("created_at", { ascending: false }),
      ]);

    const ev: TimelineEvent[] = [];

    if (pRes.data?.created_at) {
      ev.push({
        id: `p-${pazienteId}`,
        ts: pRes.data.created_at,
        kind: "paziente_creato",
        title: "Paziente registrato",
      });
    }

    if (anRes.data?.updated_at && anRes.data.updated_at !== anRes.data.created_at) {
      ev.push({
        id: `an-${pazienteId}`,
        ts: anRes.data.updated_at,
        kind: "anamnesi",
        title: "Anamnesi aggiornata",
      });
    }

    (fRes.data ?? []).forEach((r) =>
      ev.push({
        id: `fl-${r.id}`,
        ts: r.created_at,
        kind: "flag",
        title: `Flag rischio: ${r.etichetta}`,
        detail: r.origine === "auto" ? "Calcolato dall'anamnesi" : "Manuale",
        severity: r.severity as TimelineEvent["severity"],
      }),
    );

    (alRes.data ?? []).forEach((r) =>
      ev.push({
        id: `al-${r.id}`,
        ts: r.created_at,
        kind: "alert",
        title: `Alert: ${r.testo}`,
        detail: r.attivo ? undefined : "(disattivato)",
        severity: r.severity as TimelineEvent["severity"],
      }),
    );

    (plRes.data ?? []).forEach((r) =>
      ev.push({
        id: `pl-${r.id}`,
        ts: r.created_at,
        kind: "piano",
        title: `Piano: ${r.titolo}`,
        detail: `Stato: ${r.stato}`,
      }),
    );

    (sdRes.data ?? []).forEach((r) => {
      if (!r.data_seduta) return;
      ev.push({
        id: `sd-${r.id}`,
        ts: r.data_seduta,
        kind: "seduta",
        title: `Seduta #${r.numero_seduta}${r.completata ? "" : " (programmata)"}`,
        detail: r.note_cliniche ?? undefined,
      });
    });

    (fuRes.data ?? []).forEach((r) => {
      ev.push({
        id: `fu-${r.id}`,
        ts: r.data_followup,
        kind: "followup",
        title: "Follow-up",
        detail: [r.esito, r.note].filter(Boolean).join(" — ") || undefined,
      });
      if (r.complicanza_segnalata) {
        ev.push({
          id: `cp-${r.id}`,
          ts: r.data_followup,
          kind: "complicanza",
          title: "Complicanza segnalata",
          detail: r.complicanza_descrizione ?? undefined,
          severity: "critico",
        });
      }
    });

    (cnRes.data ?? []).forEach((r) =>
      ev.push({
        id: `cn-${r.id}`,
        ts: r.firmato_il,
        kind: "consenso",
        title: `Consenso firmato: ${r.titolo_snapshot}`,
      }),
    );

    const noteList = (ntRes.data ?? []) as PazienteNota[];
    noteList.forEach((n) => {
      const all = Array.isArray(n.allegati) ? (n.allegati as NotaAllegato[]) : [];
      ev.push({
        id: `nt-${n.id}`,
        ts: n.data_evento,
        kind: "nota",
        title: TIPO_LABEL[n.tipo],
        detail: n.testo,
        notaTipo: n.tipo,
        allegati: all,
      });
    });

    // Audit anagrafica: cambi di telefono/email/CF/indirizzo
    (auRes.data ?? []).forEach((r) => {
      const meta = (r.metadata ?? {}) as Record<string, { prima?: unknown; dopo?: unknown }>;
      const campi = Object.keys(meta);
      if (campi.length === 0) return;
      const detail = campi
        .map((k) => {
          const m = meta[k] ?? {};
          return `${k}: "${m.prima ?? "—"}" → "${m.dopo ?? "—"}"`;
        })
        .join("\n");
      ev.push({
        id: `au-${r.id}`,
        ts: r.created_at,
        kind: "audit",
        title: "Anagrafica modificata",
        detail,
      });
    });

    // Versioni anamnesi (snapshot precedenti dopo aggiornamento)
    (avRes.data ?? []).forEach((r) => {
      ev.push({
        id: `av-${r.id}`,
        ts: r.created_at,
        kind: "anamnesi",
        title: "Versione anamnesi archiviata",
      });
    });

    ev.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    setEvents(ev);
    setNotes(noteList);
    setPaziente((pRes.data as Paziente | null) ?? null);
    setLoading(false);
  }

  async function stampaRelazione(note: PazienteNota) {
    if (!paziente) {
      toast.error("Dati paziente non disponibili");
      return;
    }
    try {
      const { studio } = await loadStudioForPdf();
      const { blob } = generaPdfRelazione({
        paziente: {
          cognome: paziente.cognome,
          nome: paziente.nome,
          codice_fiscale: paziente.codice_fiscale,
          data_nascita: paziente.data_nascita,
        },
        studio,
        dataNota: new Date(note.data_evento),
        testo: note.testo,
        medicoNome: nomeVisualizzato(profilo ?? null, ""),
      });
      printBlob(blob);
    } catch (e) {
      toast.error(`Errore generazione PDF: ${(e as Error).message}`);
    }
  }

  async function aggiungiNota() {
    if (!testo.trim()) return;
    setUploading(true);
    try {
      const dataIso = new Date(dataEvento).toISOString();
      const testoTrim = testo.trim();
      const { data: nota, error } = await supabase
        .from("paziente_nota")
        .insert({
          paziente_id: pazienteId,
          tipo,
          testo: testoTrim,
          data_evento: dataIso,
          created_by: user?.id,
        })
        .select("id")
        .single();
      if (error) {
        toast.error(`Errore: ${error.message}`);
        return;
      }

      // Upload allegati (se presenti)
      if (nota && allegatiFile.length > 0) {
        const uploaded: NotaAllegato[] = [];
        for (const f of allegatiFile) {
          const safeName = f.name.replace(/[^\w.\-]+/g, "_");
          const path = `${pazienteId}/${nota.id}/${Date.now()}-${safeName}`;
          const { error: upErr } = await supabase.storage
            .from("nota-allegati")
            .upload(path, f, { upsert: false, contentType: f.type || undefined });
          if (upErr) {
            toast.warning(`Allegato "${f.name}" non caricato: ${upErr.message}`);
          } else {
            uploaded.push({ path, nome: f.name, mime: f.type || null, size: f.size });
          }
        }
        if (uploaded.length > 0) {
          await supabase
            .from("paziente_nota")
            .update({ allegati: uploaded as unknown as never })
            .eq("id", nota.id);
        }
      }

      // Opzionale: crea anche evento calendario collegato
      if (aggiungiAlCalendario && nota) {
        const titolo = testoTrim.length > 60 ? testoTrim.slice(0, 60) + "…" : testoTrim;
        const { error: evErr } = await supabase.from("evento_calendario").insert({
          titolo,
          descrizione: testoTrim,
          tipo: "promemoria",
          data_inizio: dataIso,
          paziente_id: pazienteId,
          sincronizza_diario: true,
          nota_diario_id: nota.id,
          created_by: user?.id,
        });
        if (evErr) {
          toast.warning("Nota salvata, ma evento calendario non creato");
        }
      }

      setTesto("");
      setTipo("clinica");
      setDataEvento(nowLocal());
      setDataEventoTouched(false);
      setAggiungiAlCalendario(false);
      setAllegatiFile([]);
      toast.success("Nota aggiunta al diario");
      void load();
    } finally {
      setUploading(false);
    }
  }

  async function apriAllegato(path: string) {
    const { data, error } = await supabase.storage
      .from("nota-allegati")
      .createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Impossibile aprire l'allegato");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function eliminaNota(id: string) {
    if (!hasRole("medico")) {
      toast.error("Solo i medici possono eliminare note");
      return;
    }
    const ok = await confirmDialog({
      title: "Eliminare nota",
      description: "Eliminare questa nota dal diario?",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("paziente_nota").delete().eq("id", id);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    toast.success("Nota eliminata");
    void load();
  }

  const filtered = events.filter((e) => {
    if (filtro === "tutti") return true;
    if (filtro === "note") return e.kind === "nota";
    if (filtro === "clinici")
      return ["seduta", "followup", "complicanza", "anamnesi", "consenso"].includes(e.kind);
    if (filtro === "rischi") return ["flag", "alert", "complicanza"].includes(e.kind);
    return true;
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Aggiungi al diario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[180px_220px_1fr]">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as NotaTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clinica">Nota clinica</SelectItem>
                  <SelectItem value="telefonata">Telefonata</SelectItem>
                  <SelectItem value="promemoria">Promemoria</SelectItem>
                  <SelectItem value="altro">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Data / ora</Label>
                <button
                  type="button"
                  onClick={() => {
                    setDataEvento(nowLocal());
                    setDataEventoTouched(false);
                  }}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Adesso
                </button>
              </div>
              <input
                type="datetime-local"
                value={dataEvento}
                onChange={(e) => {
                  setDataEvento(e.target.value);
                  setDataEventoTouched(true);
                }}
                onFocus={() => {
                  if (!dataEventoTouched) setDataEvento(nowLocal());
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Testo</Label>
              <Textarea
                rows={2}
                value={testo}
                onChange={(e) => setTesto(e.target.value)}
                placeholder="Es. Paziente ha telefonato per gonfiore lieve in zona zigomo dx"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Label
                htmlFor="diario-allegati"
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
              >
                <Paperclip className="h-4 w-4" />
                Allega file
              </Label>
              <input
                id="diario-allegati"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setAllegatiFile((prev) => [...prev, ...files]);
                  e.target.value = "";
                }}
              />
              {allegatiFile.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {allegatiFile.length} file selezionati
                </span>
              )}
            </div>
            {allegatiFile.length > 0 && (
              <ul className="space-y-1">
                {allegatiFile.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded border border-border bg-muted/40 px-2 py-1 text-xs"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAllegatiFile((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Rimuovi"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={aggiungiAlCalendario}
                onCheckedChange={(v) => setAggiungiAlCalendario(!!v)}
              />
              <span className="text-muted-foreground">Aggiungi anche al calendario</span>
            </label>
            <Button onClick={aggiungiNota} disabled={!testo.trim() || uploading}>
              <Plus className="h-4 w-4" />
              {uploading ? "Salvataggio…" : "Aggiungi"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filtro:</span>
          <Select value={filtro} onValueChange={setFiltro}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tutti">Tutti gli eventi</SelectItem>
              <SelectItem value="clinici">Solo eventi clinici</SelectItem>
              <SelectItem value="rischi">Solo flag/alert/complicanze</SelectItem>
              <SelectItem value="note">Solo note manuali</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} di {events.length} eventi
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento timeline…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun evento da mostrare.</p>
      ) : (
        <ol className="relative space-y-3 border-l border-border pl-6">
          {filtered.map((e) => {
            const isNote = e.kind === "nota";
            const note = isNote ? notes.find((n) => `nt-${n.id}` === e.id) : null;
            return (
              <li key={e.id} className="relative">
                <span
                  className={`absolute -left-[34px] flex h-7 w-7 items-center justify-center rounded-full border ${iconBg(e)}`}
                  aria-hidden
                >
                  {iconFor(e)}
                </span>
                <div className="rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{e.title}</span>
                      {e.severity ? <SevPill sev={e.severity} /> : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <time className="text-xs text-muted-foreground">{fmt(e.ts)}</time>
                      {isNote && note && note.tipo === "clinica" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Stampa relazione su carta intestata"
                          onClick={() => void stampaRelazione(note)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      {isNote && hasRole("medico") && note ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => void eliminaNota(note.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {e.detail ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {e.detail}
                    </p>
                  ) : null}
                  {e.allegati && e.allegati.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {e.allegati.map((a) => (
                        <li key={a.path}>
                          <button
                            type="button"
                            onClick={() => void apriAllegato(a.path)}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs hover:bg-accent"
                          >
                            <Paperclip className="h-3 w-3" />
                            <span className="max-w-[200px] truncate">{a.nome}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function iconFor(e: TimelineEvent) {
  const cls = "h-3.5 w-3.5";
  switch (e.kind) {
    case "paziente_creato":
      return <UserPlus className={cls} />;
    case "anamnesi":
      return <ClipboardList className={cls} />;
    case "flag":
      return <ShieldAlert className={cls} />;
    case "alert":
      return <AlertCircle className={cls} />;
    case "piano":
      return <CalendarPlus className={cls} />;
    case "seduta":
      return <Stethoscope className={cls} />;
    case "followup":
      return <Activity className={cls} />;
    case "complicanza":
      return <ShieldAlert className={cls} />;
    case "consenso":
      return <FileSignature className={cls} />;
    case "audit":
      return <Pencil className={cls} />;
    case "nota":
      if (e.notaTipo === "telefonata") return <Phone className={cls} />;
      if (e.notaTipo === "promemoria") return <MessageCircle className={cls} />;
      return <StickyNote className={cls} />;
  }
}

function iconBg(e: TimelineEvent) {
  if (e.severity === "critico") return "bg-destructive/15 border-destructive/40 text-destructive";
  if (e.severity === "attenzione") return "bg-warning/15 border-warning/40 text-warning-foreground";
  switch (e.kind) {
    case "seduta":
    case "followup":
      return "bg-primary/10 border-primary/30 text-primary";
    case "consenso":
      return "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-400";
    case "nota":
      return "bg-accent border-border text-foreground";
    default:
      return "bg-muted border-border text-muted-foreground";
  }
}

function SevPill({ sev }: { sev: "info" | "attenzione" | "critico" }) {
  const variant =
    sev === "critico" ? "destructive" : sev === "attenzione" ? "secondary" : "outline";
  return (
    <Badge variant={variant} className="text-[10px] uppercase tracking-wider">
      {sev}
    </Badge>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
