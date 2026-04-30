import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, FileSignature, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import {
  CATEGORIA_LABELS,
  
  type ConsensoCategoria,
  type ConsensoTemplate,
  type Trattamento,
} from "@/types/trattamenti";

export const Route = createFileRoute("/_authenticated/consensi/")({
  component: ConsensiPage,
});

function ConsensiPage() {
  const { hasRole } = useAuth();
  const isMedico = hasRole("medico");
  const [templates, setTemplates] = useState<ConsensoTemplate[]>([]);
  const [trattamenti, setTrattamenti] = useState<Trattamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ConsensoTemplate | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [tplRes, trRes] = await Promise.all([
      supabase.from("consenso_template").select("*").order("titolo"),
      supabase.from("trattamenti").select("*").eq("attivo", true).order("nome"),
    ]);
    if (tplRes.error) toast.error(tplRes.error.message);
    setTemplates((tplRes.data ?? []) as unknown as ConsensoTemplate[]);
    setTrattamenti((trRes.data ?? []) as Trattamento[]);
    setLoading(false);
  }

  async function toggleAttivo(t: ConsensoTemplate) {
    const { error } = await supabase
      .from("consenso_template")
      .update({ attivo: !t.attivo })
      .eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Consensi informati
          </h1>
          <p className="text-sm text-muted-foreground">
            Modelli di consenso da far firmare ai pazienti su tablet o caricare come PDF.
          </p>
        </div>
        {isMedico && (
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(null)}>
                <Plus className="h-4 w-4" />
                Nuovo consenso
              </Button>
            </DialogTrigger>
            <TemplateDialog
              editing={editing}
              trattamenti={trattamenti}
              onSaved={() => {
                setOpen(false);
                setEditing(null);
                void load();
              }}
            />
          </Dialog>
        )}
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileSignature className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nessun consenso ancora creato.
            </p>
            {isMedico && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
                Crea il primo consenso
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map((t) => {
            const trat = trattamenti.find((x) => x.id === t.trattamento_id);
            return (
              <Card key={t.id} className={t.attivo ? "" : "opacity-60"}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-semibold">
                        {t.titolo}
                      </h3>
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        v{t.versione}
                      </span>
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-primary">
                        {CATEGORIA_LABELS[t.categoria]}
                      </span>
                      {trat && (
                        <span className="rounded-full border border-accent bg-accent px-2 py-0.5 text-[11px] uppercase tracking-wide text-accent-foreground">
                          {trat.nome}
                        </span>
                      )}
                      {t.durata_tipo === "sedute" && t.durata_sedute != null ? (
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] tracking-wide text-muted-foreground">
                          Validità {t.durata_sedute} sedute
                        </span>
                      ) : t.validita_mesi != null ? (
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] tracking-wide text-muted-foreground">
                          Validità {t.validita_mesi} mesi
                        </span>
                      ) : null}
                      {!t.attivo && (
                        <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[11px] uppercase tracking-wide">
                          Disattivato
                        </span>
                      )}
                    </div>
                    {t.descrizione && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t.descrizione}
                      </p>
                    )}
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {t.testo}
                    </p>
                  </div>
                  {isMedico && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(t);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void toggleAttivo(t)}
                        title={t.attivo ? "Disattiva" : "Attiva"}
                      >
                        <Power className="h-4 w-4" />
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

type TipoUI = "gdpr" | "uso_immagini" | "trattamento" | "altro";
type ModValidita = "singola" | "ciclo";

const TIPO_LABELS: Record<TipoUI, string> = {
  gdpr: "GDPR",
  uso_immagini: "Uso immagini",
  trattamento: "Trattamento",
  altro: "Altro",
};

function categoriaToTipo(c: ConsensoCategoria): { tipo: TipoUI; mod: ModValidita } {
  if (c === "gdpr") return { tipo: "gdpr", mod: "singola" };
  if (c === "uso_immagini") return { tipo: "uso_immagini", mod: "singola" };
  if (c === "trattamento_singolo") return { tipo: "trattamento", mod: "singola" };
  if (c === "trattamento_ciclo") return { tipo: "trattamento", mod: "ciclo" };
  // anamnesi (legacy) e altro → "altro"
  return { tipo: "altro", mod: "singola" };
}

function titoloAuto(tipo: TipoUI, trattamentoNome: string | null): string {
  if (tipo === "gdpr") return "Informativa privacy e GDPR";
  if (tipo === "uso_immagini") return "Consenso uso immagini";
  if (tipo === "trattamento" && trattamentoNome) return `Consenso per ${trattamentoNome}`;
  return "";
}

function TemplateDialog({
  editing,
  trattamenti,
  onSaved,
}: {
  editing: ConsensoTemplate | null;
  trattamenti: Trattamento[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const initialMap = editing
    ? categoriaToTipo(editing.categoria)
    : { tipo: "gdpr" as TipoUI, mod: "singola" as ModValidita };

  const [titolo, setTitolo] = useState(editing?.titolo ?? "");
  const [titoloDirty, setTitoloDirty] = useState(!!editing?.titolo);
  const [testo, setTesto] = useState(editing?.testo ?? "");
  const [versione, setVersione] = useState(editing?.versione ?? "1.0");
  const [tipoUI, setTipoUI] = useState<TipoUI>(initialMap.tipo);
  const [modValidita, setModValidita] = useState<ModValidita>(initialMap.mod);
  const [cicloDurataTipo, setCicloDurataTipo] = useState<"mesi" | "sedute">(
    editing
      ? editing.durata_tipo === "sedute"
        ? "sedute"
        : "mesi"
      : "sedute",
  );
  const [cicloDurata, setCicloDurata] = useState<string>(
    editing?.categoria === "trattamento_ciclo"
      ? String(
          editing.durata_tipo === "sedute"
            ? editing.durata_sedute ?? 3
            : editing.validita_mesi ?? 12,
        )
      : "3",
  );
  const [descrizione, setDescrizione] = useState(editing?.descrizione ?? "");
  const [trattamentoId, setTrattamentoId] = useState<string>(
    editing?.trattamento_id ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [legacyAnamnesi, setLegacyAnamnesi] = useState(
    editing?.categoria === "anamnesi",
  );

  React.useEffect(() => {
    const map = editing
      ? categoriaToTipo(editing.categoria)
      : { tipo: "gdpr" as TipoUI, mod: "singola" as ModValidita };
    setTitolo(editing?.titolo ?? "");
    setTitoloDirty(!!editing?.titolo);
    setTesto(editing?.testo ?? "");
    setVersione(editing?.versione ?? "1.0");
    setTipoUI(map.tipo);
    setModValidita(map.mod);
    setCicloDurataTipo(
      editing
        ? editing.durata_tipo === "sedute"
          ? "sedute"
          : "mesi"
        : "sedute",
    );
    setCicloDurata(
      editing?.categoria === "trattamento_ciclo"
        ? String(
            editing.durata_tipo === "sedute"
              ? editing.durata_sedute ?? 3
              : editing.validita_mesi ?? 12,
          )
        : "3",
    );
    setDescrizione(editing?.descrizione ?? "");
    setTrattamentoId(editing?.trattamento_id ?? "");
    setLegacyAnamnesi(editing?.categoria === "anamnesi");
  }, [editing]);

  // Auto-titolo se l'utente non l'ha modificato manualmente
  const trattamentoSelezionato = trattamenti.find((t) => t.id === trattamentoId) ?? null;
  const trattamentoNome = trattamentoSelezionato?.nome ?? null;
  React.useEffect(() => {
    if (titoloDirty) return;
    const auto = titoloAuto(tipoUI, trattamentoNome);
    if (auto) setTitolo(auto);
  }, [tipoUI, trattamentoNome, titoloDirty]);

  // Auto-precompila durata sedute quando si seleziona un trattamento ciclo
  // (solo in creazione, non in modifica di un template esistente)
  React.useEffect(() => {
    if (editing) return;
    if (tipoUI !== "trattamento") return;
    if (modValidita !== "ciclo") return;
    if (cicloDurataTipo !== "sedute") return;
    if (!trattamentoSelezionato) return;
    const n = trattamentoSelezionato.durata_ciclo_valore;
    if (typeof n === "number" && n > 0) {
      setCicloDurata(String(n));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trattamentoId, tipoUI, modValidita, cicloDurataTipo]);

  function changeTipo(t: TipoUI) {
    setTipoUI(t);
    if (t !== "trattamento") {
      setTrattamentoId("");
    }
  }

  async function save() {
    if (!titolo.trim() || !testo.trim()) {
      toast.error("Titolo e testo sono obbligatori");
      return;
    }

    let categoriaSalvata: ConsensoCategoria;
    let validitaMesiSalvata: number | null;
    let duratSeduteSalvata: number | null = null;
    let duratTipoSalvato: "mesi" | "sedute" = "mesi";
    let trattamentoIdSalvato: string | null = null;

    if (tipoUI === "trattamento") {
      if (!trattamentoId) {
        toast.error("Seleziona il trattamento collegato");
        return;
      }
      trattamentoIdSalvato = trattamentoId;
      if (modValidita === "singola") {
        categoriaSalvata = "trattamento_singolo";
        validitaMesiSalvata = null;
      } else {
        const n = Number(cicloDurata);
        if (!Number.isFinite(n) || n <= 0) {
          toast.error("Durata del ciclo non valida");
          return;
        }
        categoriaSalvata = "trattamento_ciclo";
        if (cicloDurataTipo === "sedute") {
          duratTipoSalvato = "sedute";
          duratSeduteSalvata = Math.max(1, Math.round(n));
          validitaMesiSalvata = null;
        } else {
          duratTipoSalvato = "mesi";
          validitaMesiSalvata = Math.max(1, Math.round(n));
        }
      }
    } else if (tipoUI === "gdpr") {
      categoriaSalvata = "gdpr";
      validitaMesiSalvata = null;
    } else if (tipoUI === "uso_immagini") {
      categoriaSalvata = "uso_immagini";
      validitaMesiSalvata = null;
    } else {
      categoriaSalvata = "altro";
      validitaMesiSalvata = null;
    }

    setSaving(true);
    const basePayload = {
      titolo: titolo.trim(),
      testo: testo.trim(),
      categoria: categoriaSalvata,
      validita_mesi: validitaMesiSalvata,
      durata_tipo: duratTipoSalvato,
      durata_sedute: duratSeduteSalvata,
      descrizione: descrizione.trim() || null,
      trattamento_id: trattamentoIdSalvato,
    };
    const { error } = editing
      ? await supabase
          .from("consenso_template")
          // versione NON inclusa: il trigger la incrementa automaticamente se cambia il contenuto
          .update(basePayload)
          .eq("id", editing.id)
      : await supabase
          .from("consenso_template")
          .insert({ ...basePayload, versione: "1.0", created_by: user?.id });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Consenso aggiornato (versione incrementata se modificato)" : "Consenso creato");
    onSaved();
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display">
          {editing ? "Modifica consenso" : "Nuovo consenso"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        {legacyAnamnesi && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
            Categoria <strong>Anamnesi</strong> deprecata: salvando convertirai questo
            template in <strong>Altro</strong>. Considera di archiviarlo se non più in uso.
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Tipo *</Label>
            <Select value={tipoUI} onValueChange={(v) => changeTipo(v as TipoUI)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_LABELS) as TipoUI[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {TIPO_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Versione</Label>
            <Input
              value={versione}
              readOnly
              disabled
              title="Aggiornata automaticamente ad ogni modifica del consenso"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Aggiornata automaticamente ad ogni modifica.
            </p>
          </div>
        </div>

        {tipoUI === "trattamento" && (
          <>
            <div>
              <Label>Trattamento collegato *</Label>
              <Select value={trattamentoId} onValueChange={setTrattamentoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un trattamento…" />
                </SelectTrigger>
                <SelectContent>
                  {trattamenti.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Nessun trattamento attivo. Crealo prima in Trattamenti.
                    </div>
                  ) : (
                    trattamenti.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Modalità validità *</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={modValidita === "singola" ? "default" : "outline"}
                  onClick={() => setModValidita("singola")}
                >
                  Singola seduta
                </Button>
                <Button
                  type="button"
                  variant={modValidita === "ciclo" ? "default" : "outline"}
                  onClick={() => setModValidita("ciclo")}
                >
                  Ciclo
                </Button>
              </div>
              {modValidita === "singola" ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Validità legata alla singola seduta: serve un nuovo consenso ogni volta.
                </p>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px]">
                  <div>
                    <Label>
                      {cicloDurataTipo === "sedute"
                        ? "Numero sedute *"
                        : "Durata (mesi) *"}
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={cicloDurata}
                      onChange={(e) => setCicloDurata(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Unità</Label>
                    <Select
                      value={cicloDurataTipo}
                      onValueChange={(v) =>
                        setCicloDurataTipo(v as "mesi" | "sedute")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sedute">Sedute</SelectItem>
                        <SelectItem value="mesi">Mesi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-[11px] text-muted-foreground md:col-span-2">
                    {cicloDurataTipo === "sedute"
                      ? "Il consenso resta valido finché non si raggiunge questo numero di sedute eseguite."
                      : "Il consenso scade al termine del periodo indicato (in mesi) dalla data di firma."}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        <div>
          <Label>Titolo *</Label>
          <Input
            value={titolo}
            onChange={(e) => {
              setTitolo(e.target.value);
              setTitoloDirty(true);
            }}
            placeholder="Verrà compilato automaticamente in base al tipo"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Suggerito automaticamente in base al tipo, modificabile.
          </p>
        </div>

        <div>
          <Label>Descrizione interna</Label>
          <Input
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
            placeholder="Note operative (non mostrate al paziente)"
          />
        </div>

        <div>
          <Label>Testo del consenso *</Label>
          <Textarea
            rows={10}
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            placeholder="Inserisci il testo completo del consenso informato…"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Modificando il testo aggiorna la versione: i consensi firmati con la versione
            precedente diventeranno "obsoleti" e dovranno essere rifirmati.
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvataggio…" : "Salva template"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}