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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Syringe, Pencil, Power } from "lucide-react";
import { toast } from "sonner";
import type { Trattamento } from "@/types/trattamenti";

export const Route = createFileRoute("/_authenticated/trattamenti/")({
  component: TrattamentiPage,
});

function TrattamentiPage() {
  const { hasRole } = useAuth();
  const isMedico = hasRole("medico");
  const [items, setItems] = useState<Trattamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Trattamento | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("trattamenti")
      .select("*")
      .order("nome");
    if (error) toast.error(error.message);
    setItems((data ?? []) as Trattamento[]);
    setLoading(false);
  }

  async function toggleAttivo(t: Trattamento) {
    const { error } = await supabase
      .from("trattamenti")
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
            Trattamenti
          </h1>
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
            <TrattamentoDialog
              editing={editing}
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
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Syringe className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nessun trattamento in catalogo.
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
          {items.map((t) => (
            <Card key={t.id} className={t.attivo ? "" : "opacity-60"}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold">
                      {t.nome}
                    </h3>
                    {t.categoria && (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                        {t.categoria}
                      </span>
                    )}
                    {!t.attivo && (
                      <span className="rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[11px] uppercase tracking-wide">
                        Disattivato
                      </span>
                    )}
                  </div>
                  {t.descrizione && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.descrizione}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {t.durata_minuti != null && (
                      <span>Durata: {t.durata_minuti} min</span>
                    )}
                    {t.prezzo_indicativo != null && (
                      <span>Prezzo: € {Number(t.prezzo_indicativo).toFixed(2)}</span>
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
                      onClick={() => void toggleAttivo(t)}
                      title={t.attivo ? "Disattiva" : "Attiva"}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TrattamentoDialog({
  editing,
  onSaved,
}: {
  editing: Trattamento | null;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [categoria, setCategoria] = useState(editing?.categoria ?? "");
  const [descrizione, setDescrizione] = useState(editing?.descrizione ?? "");
  const [durata, setDurata] = useState<string>(
    editing?.durata_minuti?.toString() ?? "",
  );
  const [prezzo, setPrezzo] = useState<string>(
    editing?.prezzo_indicativo?.toString() ?? "",
  );
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setNome(editing?.nome ?? "");
    setCategoria(editing?.categoria ?? "");
    setDescrizione(editing?.descrizione ?? "");
    setDurata(editing?.durata_minuti?.toString() ?? "");
    setPrezzo(editing?.prezzo_indicativo?.toString() ?? "");
  }, [editing]);

  async function save() {
    if (!nome.trim()) {
      toast.error("Il nome è obbligatorio");
      return;
    }
    setSaving(true);
    const payload = {
      nome: nome.trim(),
      categoria: categoria.trim() || null,
      descrizione: descrizione.trim() || null,
      durata_minuti: durata ? Number(durata) : null,
      prezzo_indicativo: prezzo ? Number(prezzo) : null,
    };
    const { error } = editing
      ? await supabase.from("trattamenti").update(payload).eq("id", editing.id)
      : await supabase
          .from("trattamenti")
          .insert({ ...payload, created_by: user?.id });
    setSaving(false);
    if (error) {
      toast.error(error.message);
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
      <div className="space-y-3">
        <div>
          <Label>Nome *</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <Label>Categoria</Label>
          <Input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder="Es. Filler, Botulino, Laser…"
          />
        </div>
        <div>
          <Label>Descrizione</Label>
          <Textarea
            rows={3}
            value={descrizione}
            onChange={(e) => setDescrizione(e.target.value)}
          />
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
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvataggio…" : "Salva"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
