import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SeverityBadge } from "./pazienti.index";
import type {
  Paziente,
  PazienteAlert,
  FlagRischio,
  AlertSeverity,
} from "@/types/clinico";
import { computeAutoFlags, type AnamnesiPayload } from "@/lib/flag-rischio";

export const Route = createFileRoute("/_authenticated/pazienti/$id")({
  component: PazienteDetailPage,
});

const SEZIONI_ANAMNESI: { key: keyof AnamnesiData; label: string; campi: AnamnesiCampo[] }[] = [
  {
    key: "generale",
    label: "Generale",
    campi: [
      { k: "gravidanza", l: "In gravidanza" },
      { k: "allattamento", l: "In allattamento" },
      { k: "portatore_pacemaker", l: "Portatore pacemaker / dispositivo elettronico" },
    ],
  },
  {
    key: "patologica",
    label: "Patologica",
    campi: [
      { k: "diabete", l: "Diabete" },
      { k: "cardiopatia", l: "Cardiopatia" },
      { k: "ipertensione", l: "Ipertensione arteriosa" },
      { k: "epilessia", l: "Epilessia" },
      { k: "tumori_attivi", l: "Patologia oncologica attiva" },
      { k: "malattie_autoimmuni", l: "Malattie autoimmuni" },
      { k: "cheloidi", l: "Tendenza alla formazione di cheloidi" },
      { k: "herpes_recidivante", l: "Herpes labiale recidivante" },
    ],
  },
  {
    key: "farmacologica",
    label: "Farmaci",
    campi: [
      { k: "anticoagulanti", l: "Terapia anticoagulante / antiaggregante" },
      { k: "cortisonici", l: "Terapia cortisonica in corso" },
      { k: "isotretinoina_recente", l: "Isotretinoina ultimi 6 mesi" },
      { k: "immunosoppressori", l: "Terapia immunosoppressiva" },
    ],
  },
  {
    key: "allergologica",
    label: "Allergie",
    campi: [
      { k: "lattice", l: "Allergia al lattice" },
      { k: "anestetici_locali", l: "Allergia anestetici locali" },
    ],
  },
  {
    key: "abitudini",
    label: "Abitudini",
    campi: [
      { k: "fuma", l: "Fumatore" },
      { k: "alcol_eccesso", l: "Consumo eccessivo di alcol" },
    ],
  },
];

interface AnamnesiCampo {
  k: string;
  l: string;
}

interface AnamnesiData {
  id: string;
  paziente_id: string;
  generale: Record<string, boolean>;
  patologica: Record<string, boolean>;
  farmacologica: Record<string, boolean>;
  allergologica: Record<string, boolean | string>;
  ostetrica: Record<string, unknown>;
  abitudini: Record<string, boolean>;
  estetica: Record<string, unknown>;
  note_libere: string | null;
}

function PazienteDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [paziente, setPaziente] = useState<Paziente | null>(null);
  const [alerts, setAlerts] = useState<PazienteAlert[]>([]);
  const [flags, setFlags] = useState<FlagRischio[]>([]);
  const [anamnesi, setAnamnesi] = useState<AnamnesiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, [id]);

  async function load() {
    setLoading(true);
    const [pRes, aRes, fRes, anRes] = await Promise.all([
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
      supabase.from("anamnesi").select("*").eq("paziente_id", id).maybeSingle(),
    ]);

    if (pRes.error || !pRes.data) {
      toast.error("Paziente non trovato");
      void navigate({ to: "/pazienti" });
      return;
    }
    setPaziente(pRes.data as Paziente);
    setAlerts((aRes.data ?? []) as PazienteAlert[]);
    setFlags((fRes.data ?? []) as FlagRischio[]);
    setAnamnesi(
      (anRes.data ?? null) as AnamnesiData | null,
    );

    // log accesso (best-effort, non bloccante)
    if (user?.id) {
      void supabase
        .from("paziente_access_log")
        .insert({ paziente_id: id, user_id: user.id, azione: "view" });
    }

    setLoading(false);
  }

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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/pazienti" })}>
          <ArrowLeft className="h-4 w-4" />
          Lista pazienti
        </Button>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
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
        <Button
          variant="outline"
          onClick={() => navigate({ to: "/pazienti/$id/edit", params: { id } })}
        >
          <Pencil className="h-4 w-4" />
          Modifica anagrafica
        </Button>
      </header>

      {/* Banner flag/alert critici sempre in evidenza */}
      <FlagBanner flags={flags} alerts={alerts} />

      <Tabs defaultValue="anagrafica" className="space-y-4">
        <TabsList>
          <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
          <TabsTrigger value="anamnesi">Anamnesi</TabsTrigger>
          <TabsTrigger value="alert">Alert ({alerts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="anagrafica">
          <AnagraficaPanel paziente={paziente} />
        </TabsContent>

        <TabsContent value="anamnesi">
          {anamnesi ? (
            <AnamnesiPanel
              anamnesi={anamnesi}
              pazienteId={id}
              onSaved={() => void load()}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Anamnesi non disponibile.</p>
          )}
        </TabsContent>

        <TabsContent value="alert">
          <AlertPanel
            pazienteId={id}
            alerts={alerts}
            onChanged={() => void load()}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FlagBanner({ flags, alerts }: { flags: FlagRischio[]; alerts: PazienteAlert[] }) {
  const critici = [
    ...flags.filter((f) => f.severity === "critico").map((f) => f.etichetta),
    ...alerts.filter((a) => a.severity === "critico").map((a) => a.testo),
  ];
  const attenzione = [
    ...flags.filter((f) => f.severity === "attenzione").map((f) => f.etichetta),
    ...alerts.filter((a) => a.severity === "attenzione").map((a) => a.testo),
  ];

  if (critici.length === 0 && attenzione.length === 0) return null;

  return (
    <div className="space-y-2">
      {critici.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <div className="font-medium text-destructive">Attenzione clinica</div>
            <div className="text-foreground">{critici.join(" · ")}</div>
          </div>
        </div>
      )}
      {attenzione.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
          <div>
            <div className="font-medium">Da considerare</div>
            <div>{attenzione.join(" · ")}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnagraficaPanel({ paziente }: { paziente: Paziente }) {
  return (
    <Card>
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

function Info({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

function AnamnesiPanel({
  anamnesi,
  pazienteId,
  onSaved,
}: {
  anamnesi: AnamnesiData;
  pazienteId: string;
  onSaved: () => void;
}) {
  const [data, setData] = useState<AnamnesiData>(anamnesi);
  const [saving, setSaving] = useState(false);

  function toggle(sezione: keyof AnamnesiData, campo: string) {
    setData((d) => {
      const sec = (d[sezione] as Record<string, unknown>) ?? {};
      return {
        ...d,
        [sezione]: { ...sec, [campo]: !sec[campo] },
      };
    });
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("anamnesi")
      .update({
        generale: data.generale as never,
        patologica: data.patologica as never,
        farmacologica: data.farmacologica as never,
        allergologica: data.allergologica as never,
        ostetrica: data.ostetrica as never,
        abitudini: data.abitudini as never,
        estetica: data.estetica as never,
        note_libere: data.note_libere,
      })
      .eq("id", data.id);

    if (error) {
      toast.error(`Errore: ${error.message}`);
      setSaving(false);
      return;
    }

    // ricalcola flag automatici e sincronizza
    const computed = computeAutoFlags(data as unknown as AnamnesiPayload);
    // elimina flag auto esistenti
    await supabase
      .from("anamnesi_flag_rischio")
      .delete()
      .eq("paziente_id", pazienteId)
      .eq("origine", "auto");
    if (computed.length > 0) {
      await supabase.from("anamnesi_flag_rischio").insert(
        computed.map((f) => ({
          paziente_id: pazienteId,
          codice: f.codice,
          etichetta: f.etichetta,
          severity: f.severity,
          origine: "auto",
        })),
      );
    }

    toast.success("Anamnesi salvata");
    setSaving(false);
    onSaved();
  }

  return (
    <div className="space-y-4">
      {SEZIONI_ANAMNESI.map((sez) => (
        <Card key={sez.key}>
          <CardHeader>
            <CardTitle className="font-display text-base">{sez.label}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {sez.campi.map((c) => {
              const sec = (data[sez.key] as Record<string, unknown>) ?? {};
              const checked = !!sec[c.k];
              return (
                <label
                  key={c.k}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-border p-3 hover:bg-accent/40"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(sez.key, c.k)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm">{c.l}</span>
                </label>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Note libere</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            value={data.note_libere ?? ""}
            onChange={(e) => setData((d) => ({ ...d, note_libere: e.target.value }))}
            placeholder="Annotazioni anamnestiche aggiuntive…"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvataggio…" : "Salva anamnesi"}
        </Button>
      </div>
    </div>
  );
}

function AlertPanel({
  pazienteId,
  alerts,
  onChanged,
}: {
  pazienteId: string;
  alerts: PazienteAlert[];
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

// Evita errori di unused
void React;
