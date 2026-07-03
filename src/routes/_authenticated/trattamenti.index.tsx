import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
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
import { Plus, Syringe, Pencil, Archive, ArchiveRestore, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import {
  type Trattamento,
  type TrattamentoTipo,
  type DurataUnita,
  type TrattamentoCategoria,
  type KitConsumoDefaultRiga,
  TRATTAMENTO_CATEGORIE,
  TRATTAMENTO_CATEGORIA_LABELS,
} from "@/types/trattamenti";
import { ProdottoSelectInline } from "@/components/magazzino/prodotto-select-inline";
import { listProdotti } from "@/lib/magazzino";
import type { ProdottoConDettagli } from "@/types/magazzino";

export const Route = createFileRoute("/_authenticated/trattamenti/")({
  component: TrattamentiPage,
});

interface TemplateOption {
  id: string;
  titolo: string;
  versione: string;
  categoria: string;
}

function TrattamentiPage() {
  const { hasRole } = useAuth();
  const isMedico = hasRole("medico");
  const [mostraArchiviati, setMostraArchiviati] = useState(false);
  const [items, setItems] = useState<Trattamento[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Trattamento | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const [tratt, tpl] = await Promise.all([
      supabase.from("trattamenti").select("*").order("nome"),
      supabase
        .from("consenso_template")
        .select("id, titolo, versione, categoria")
        .eq("attivo", true)
        .in("categoria", ["trattamento_singolo", "trattamento_ciclo"])
        .order("titolo"),
    ]);
    if (tratt.error) toast.error(tratt.error.message);
    if (tpl.error) toast.error(tpl.error.message);
    setItems((tratt.data ?? []) as Trattamento[]);
    setTemplates((tpl.data ?? []) as TemplateOption[]);
    setLoading(false);
  }

  async function toggleArchiviato(t: Trattamento) {
    const archiviato = t.archiviato_il != null;
    const { error } = await supabase
      .from("trattamenti")
      .update({ archiviato_il: archiviato ? null : new Date().toISOString() })
      .eq("id", t.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(archiviato ? "Trattamento ripristinato" : "Trattamento archiviato");
    void load();
  }

  const templateById = React.useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);
  const visibleItems = React.useMemo(
    () => items.filter((t) => (t.archiviato_il != null) === mostraArchiviati),
    [items, mostraArchiviati],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Trattamenti</h1>
          <p className="text-sm text-muted-foreground">
            Catalogo dei trattamenti offerti dallo studio.
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
                Nuovo trattamento
              </Button>
            </DialogTrigger>
            {open && (
              <TrattamentoDialog
                key={editing?.id ?? "new"}
                editing={editing}
                templates={templates}
                onSaved={() => {
                  setOpen(false);
                  setEditing(null);
                  void load();
                }}
              />
            )}
          </Dialog>
        )}
      </header>

      <div className="flex items-center justify-end gap-2">
        <Switch
          id="mostra-archiviati-trattamenti"
          checked={mostraArchiviati}
          onCheckedChange={(v) => setMostraArchiviati(Boolean(v))}
        />
        <Label htmlFor="mostra-archiviati-trattamenti" className="text-xs text-muted-foreground">
          Mostra archiviati
        </Label>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : visibleItems.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Syringe className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {mostraArchiviati ? "Nessun trattamento archiviato." : "Nessun trattamento attivo."}
            </p>
            {isMedico && (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" />
                Aggiungi il primo trattamento
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {visibleItems.map((t) => {
            const consenso = t.consenso_template_id
              ? templateById.get(t.consenso_template_id)
              : null;
            const archiviato = t.archiviato_il != null;
            const categoriaLabel =
              t.categoria && (TRATTAMENTO_CATEGORIE as readonly string[]).includes(t.categoria)
                ? TRATTAMENTO_CATEGORIA_LABELS[t.categoria as TrattamentoCategoria]
                : t.categoria;
            return (
              <Card key={t.id} className={archiviato || !t.attivo ? "opacity-60" : ""}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-semibold">{t.nome}</h3>
                      {categoriaLabel && (
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                          {categoriaLabel}
                        </span>
                      )}
                      {t.tipo === "singolo" && (
                        <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] uppercase tracking-wide">
                          Singolo
                        </span>
                      )}
                      {t.tipo === "ciclo" && (
                        <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] uppercase tracking-wide">
                          Ciclo {t.durata_ciclo_valore ?? "?"} sedute
                        </span>
                      )}
                      {!t.attivo && (
                        <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[11px] uppercase tracking-wide">
                          Disattivato
                        </span>
                      )}
                      {archiviato && (
                        <span className="rounded-full border border-muted-foreground/30 bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                          Archiviato
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {t.durata_minuti != null && <span>Durata: {t.durata_minuti} min</span>}
                      {t.prezzo_indicativo != null && (
                        <span>Prezzo: € {Number(t.prezzo_indicativo).toFixed(2)}</span>
                      )}
                      {consenso && (
                        <span>
                          Consenso: {consenso.titolo} (v{consenso.versione})
                        </span>
                      )}
                      {!consenso && t.consenso_template_id == null && (
                        <span className="text-warning">Consenso non collegato</span>
                      )}
                    </div>
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
                        onClick={() => void toggleArchiviato(t)}
                        title={archiviato ? "Ripristina" : "Archivia"}
                      >
                        {archiviato ? (
                          <ArchiveRestore className="h-4 w-4" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
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

function TrattamentoDialog({
  editing,
  templates,
  onSaved,
}: {
  editing: Trattamento | null;
  templates: TemplateOption[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [tipo, setTipo] = useState<TrattamentoTipo | "">(
    (editing?.tipo as TrattamentoTipo | null) ?? "",
  );
  const [duratValore, setDuratValore] = useState<string>(
    editing?.durata_ciclo_valore?.toString() ?? "",
  );
  // (Le precedenti unità mesi/settimane/giorni non sono più gestibili dalla UI:
  //  per i nuovi cicli salviamo sempre l'unità "sedute".)
  const [categoria, setCategoria] = useState<TrattamentoCategoria | "">(
    (editing?.categoria as TrattamentoCategoria | null) ?? "",
  );
  const [consensoId, setConsensoId] = useState<string>(editing?.consenso_template_id ?? "");
  const [durata, setDurata] = useState<string>(editing?.durata_minuti?.toString() ?? "");
  const [prezzo, setPrezzo] = useState<string>(editing?.prezzo_indicativo?.toString() ?? "");
  const [kit, setKit] = useState<KitConsumoDefaultRiga[]>(
    Array.isArray(editing?.kit_consumo_default) ? editing!.kit_consumo_default! : [],
  );
  const [prodotti, setProdotti] = useState<ProdottoConDettagli[]>([]);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    void listProdotti({ includiStandby: false })
      .then(setProdotti)
      .catch(() => setProdotti([]));
  }, []);

  React.useEffect(() => {
    setNome(editing?.nome ?? "");
    setTipo((editing?.tipo as TrattamentoTipo | null) ?? "");
    setDuratValore(editing?.durata_ciclo_valore?.toString() ?? "");
    setCategoria((editing?.categoria as TrattamentoCategoria | null) ?? "");
    setConsensoId(editing?.consenso_template_id ?? "");
    setDurata(editing?.durata_minuti?.toString() ?? "");
    setPrezzo(editing?.prezzo_indicativo?.toString() ?? "");
    setKit(
      Array.isArray(editing?.kit_consumo_default) ? editing!.kit_consumo_default! : [],
    );
  }, [editing]);

  async function save() {
    if (!nome.trim()) {
      toast.error("Il nome è obbligatorio");
      return;
    }
    if (tipo !== "singolo" && tipo !== "ciclo") {
      toast.error("Seleziona il tipo di trattamento");
      return;
    }
    let durValN: number | null = null;
    let durUnitN: DurataUnita | null = null;
    if (tipo === "ciclo") {
      const n = Number(duratValore);
      if (!duratValore || !Number.isFinite(n) || n <= 0) {
        toast.error("Inserisci il numero di sedute previste");
        return;
      }
      durValN = Math.floor(n);
      durUnitN = "sedute";
    }
    if (!categoria) {
      toast.error("Seleziona la categoria");
      return;
    }
    const selectedTemplate = consensoId ? templates.find((t) => t.id === consensoId) : null;
    if (selectedTemplate) {
      if (tipo === "ciclo" && selectedTemplate.categoria !== "trattamento_ciclo") {
        toast.error("Per un ciclo serve un consenso ciclo");
        return;
      }
      if (tipo === "singolo" && selectedTemplate.categoria !== "trattamento_singolo") {
        toast.error("Per un trattamento singolo serve consenso singolo");
        return;
      }
    }

    setSaving(true);
    const kitPulito = kit
      .filter((r) => r.prodotto_id && Number(r.quantita) > 0)
      .map((r) => ({ prodotto_id: r.prodotto_id, quantita: Number(r.quantita) }));
    const payload = {
      nome: nome.trim(),
      tipo,
      durata_ciclo_valore: durValN,
      durata_ciclo_unita: durUnitN,
      categoria,
      consenso_template_id: consensoId || null,
      durata_minuti: durata ? Number(durata) : null,
      prezzo_indicativo: prezzo ? Number(prezzo) : null,
      descrizione: null,
      kit_consumo_default: kitPulito,
    };
    async function runSave() {
      return editing
        ? await supabase.from("trattamenti").update(payload).eq("id", editing.id)
        : await supabase.from("trattamenti").insert({ ...payload, created_by: user?.id });
    }
    let { error } = await runSave();
    // Retry una volta con refresh sessione se sembra JWT scaduto / RLS
    if (error && (error.code === "42501" || /row-level security|JWT|expired/i.test(error.message))) {
      try {
        await supabase.auth.refreshSession();
      } catch {
        /* ignore */
      }
      ({ error } = await runSave());
    }
    setSaving(false);
    if (error) {
      toast.error(
        error.code === "42501"
          ? "Sessione scaduta o permessi insufficienti. Effettua di nuovo l'accesso."
          : error.message,
      );
      return;
    }
    toast.success(editing ? "Trattamento aggiornato" : "Trattamento creato");
    onSaved();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="font-display">
          {editing ? "Modifica trattamento" : "Nuovo trattamento"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Nome trattamento *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>

        <div>
          <Label>Tipo trattamento *</Label>
          <RadioGroup
            value={tipo}
            onValueChange={(v) => setTipo(v as TrattamentoTipo)}
            className="mt-2 grid grid-cols-2 gap-2"
          >
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2">
              <RadioGroupItem value="singolo" id="tipo-singolo" />
              <span className="text-sm">Singolo</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2">
              <RadioGroupItem value="ciclo" id="tipo-ciclo" />
              <span className="text-sm">Ciclo</span>
            </label>
          </RadioGroup>
        </div>

        {tipo === "ciclo" && (
          <div>
            <Label>Numero sedute previste *</Label>
            <Input
              type="number"
              min="1"
              value={duratValore}
              onChange={(e) => setDuratValore(e.target.value)}
              placeholder="Es. 3"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Il ciclo (e il consenso collegato) si considera concluso al raggiungimento di questo
              numero di sedute.
            </p>
          </div>
        )}

        <div>
          <Label>Categoria *</Label>
          <Select value={categoria} onValueChange={(v) => setCategoria(v as TrattamentoCategoria)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona…" />
            </SelectTrigger>
            <SelectContent>
              {TRATTAMENTO_CATEGORIE.map((c) => (
                <SelectItem key={c} value={c}>
                  {TRATTAMENTO_CATEGORIA_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Consenso associato</Label>
          <Select value={consensoId} onValueChange={setConsensoId}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  templates.length === 0
                    ? "Nessun template attivo disponibile"
                    : "Seleziona un consenso…"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.titolo} (v{t.versione})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {templates.length === 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Crea prima un template consenso (categoria trattamento) nella sezione Consensi.
            </p>
          )}
          {(() => {
            const sel = templates.find((t) => t.id === consensoId);
            if (!sel) return null;
            if (sel.categoria === "trattamento_singolo") {
              return (
                <p className="mt-1 text-xs text-success">
                  ✔ Consenso singolo: verrà richiesto a ogni seduta
                </p>
              );
            }
            if (sel.categoria === "trattamento_ciclo") {
              return (
                <p className="mt-1 text-xs text-success">
                  ✔ Consenso ciclo: valido per tutta la durata del trattamento
                </p>
              );
            }
            return null;
          })()}
        </div>

        <div className="rounded-md border border-dashed border-border/60 bg-muted/20 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">Kit consumo default</Label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setKit((k) => [...k, { prodotto_id: "", quantita: 1 }])
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Riga
            </Button>
          </div>
          <p className="mb-2 text-[11px] text-muted-foreground">
            Prodotti precompilati nel consumo magazzino di ogni seduta di questo trattamento.
          </p>
          {kit.length === 0 && (
            <p className="rounded-md border border-dashed border-border/60 bg-background/40 p-2 text-center text-xs text-muted-foreground">
              Nessun prodotto configurato.
            </p>
          )}
          <div className="space-y-2">
            {kit.map((r, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <ProdottoSelectInline
                    prodotti={prodotti}
                    value={r.prodotto_id || null}
                    onChange={(id) =>
                      setKit((k) =>
                        k.map((x, j) => (j === i ? { ...x, prodotto_id: id ?? "" } : x)),
                      )
                    }
                  />
                </div>
                <div className="w-20">
                  <Label className="text-[11px]">Q.tà</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={r.quantita}
                    onChange={(e) =>
                      setKit((k) =>
                        k.map((x, j) =>
                          j === i ? { ...x, quantita: Number(e.target.value) || 0 } : x,
                        ),
                      )
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive"
                  onClick={() => setKit((k) => k.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>


        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Durata (min)</Label>
            <Input
              type="number"
              min="0"
              value={durata}
              onChange={(e) => setDurata(e.target.value)}
            />
          </div>
          <div>
            <Label>Prezzo indicativo (€)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={prezzo}
              onChange={(e) => setPrezzo(e.target.value)}
            />
          </div>
        </div>

        {tipo === "singolo" && (
          <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
            Il consenso sarà richiesto a ogni seduta.
          </p>
        )}
        {tipo === "ciclo" && duratValore && (
          <p className="rounded-md border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
            Il consenso sarà valido per {duratValore} sedute (poi sarà richiesto un nuovo consenso).
          </p>
        )}
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvataggio…" : "Salva"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
