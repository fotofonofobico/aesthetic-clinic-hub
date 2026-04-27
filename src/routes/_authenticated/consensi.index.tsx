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
  CATEGORIA_VALIDITA_DEFAULT,
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
                Nuovo modello
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
              Nessun modello di consenso ancora creato.
            </p>
            {isMedico && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
                Crea il primo modello
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
                      {t.validita_mesi != null && (
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] tracking-wide text-muted-foreground">
                          Validità {t.validita_mesi} mesi
                        </span>
                      )}
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
  const [titolo, setTitolo] = useState(editing?.titolo ?? "");
  const [testo, setTesto] = useState(editing?.testo ?? "");
  const [versione, setVersione] = useState(editing?.versione ?? "1.0");
  const [categoria, setCategoria] = useState<ConsensoCategoria>(
    editing?.categoria ?? "trattamento_singolo",
  );
  const [validitaMesi, setValiditaMesi] = useState<string>(
    editing?.validita_mesi != null ? String(editing.validita_mesi) : "",
  );
  const [descrizione, setDescrizione] = useState(editing?.descrizione ?? "");
  const [trattamentoId, setTrattamentoId] = useState<string>(
    editing?.trattamento_id ?? "none",
  );
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setTitolo(editing?.titolo ?? "");
    setTesto(editing?.testo ?? "");
    setVersione(editing?.versione ?? "1.0");
    setCategoria(editing?.categoria ?? "trattamento_singolo");
    setValiditaMesi(
      editing?.validita_mesi != null ? String(editing.validita_mesi) : "",
    );
    setDescrizione(editing?.descrizione ?? "");
    setTrattamentoId(editing?.trattamento_id ?? "none");
  }, [editing]);

  // applica default categoria solo in creazione
  React.useEffect(() => {
    if (editing) return;
    const def = CATEGORIA_VALIDITA_DEFAULT[categoria];
    setValiditaMesi(def != null ? String(def) : "");
  }, [categoria, editing]);

  async function save() {
    if (!titolo.trim() || !testo.trim()) {
      toast.error("Titolo e testo sono obbligatori");
      return;
    }
    setSaving(true);
    const payload = {
      titolo: titolo.trim(),
      testo: testo.trim(),
      versione: versione.trim() || "1.0",
      categoria,
      validita_mesi: validitaMesi.trim() ? Number(validitaMesi) : null,
      descrizione: descrizione.trim() || null,
      trattamento_id: trattamentoId === "none" ? null : trattamentoId,
    };
    const { error } = editing
      ? await supabase
          .from("consenso_template")
          .update(payload)
          .eq("id", editing.id)
      : await supabase
          .from("consenso_template")
          .insert({ ...payload, created_by: user?.id });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editing ? "Modello aggiornato" : "Modello creato");
    onSaved();
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display">
          {editing ? "Modifica modello" : "Nuovo modello di consenso"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_120px]">
          <div>
            <Label>Titolo *</Label>
            <Input value={titolo} onChange={(e) => setTitolo(e.target.value)} />
          </div>
          <div>
            <Label>Versione</Label>
            <Input
              value={versione}
              onChange={(e) => setVersione(e.target.value)}
              placeholder="1.0"
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Categoria *</Label>
            <Select
              value={categoria}
              onValueChange={(v) => setCategoria(v as ConsensoCategoria)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORIA_LABELS) as ConsensoCategoria[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {CATEGORIA_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Validità (mesi)</Label>
            <Input
              type="number"
              min="0"
              value={validitaMesi}
              onChange={(e) => setValiditaMesi(e.target.value)}
              placeholder="Vuoto = nessuna scadenza"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Vuoto = valido fino a revoca o nuova versione del template.
            </p>
          </div>
        </div>

        <div>
          <Label>Trattamento collegato</Label>
          <Select value={trattamentoId} onValueChange={setTrattamentoId}>
            <SelectTrigger>
              <SelectValue placeholder="Nessuno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Nessuno (generico) —</SelectItem>
              {trattamenti.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          {saving ? "Salvataggio…" : "Salva modello"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
