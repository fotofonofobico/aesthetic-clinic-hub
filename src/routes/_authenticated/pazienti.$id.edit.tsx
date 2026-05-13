import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { validateCFInput, normalizeCF } from "@/lib/codice-fiscale";
import type { Paziente, Sesso } from "@/types/clinico";

export const Route = createFileRoute("/_authenticated/pazienti/$id/edit")({
  component: PazienteEditPage,
});

function PazienteEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isNew = id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Paziente>>({
    nome: "",
    cognome: "",
    sesso: null,
    data_nascita: null,
    luogo_nascita: "",
    codice_fiscale: "",
    email: "",
    telefono: "",
    indirizzo: "",
    citta: "",
    cap: "",
    provincia: "",
    professione: "",
    note: "",
    peso_kg: null,
    altezza_cm: null,
  });

  useEffect(() => {
    if (isNew) return;
    void load();
  }, [id]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("pazienti")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) {
      toast.error("Paziente non trovato");
      void navigate({ to: "/pazienti" });
      return;
    }
    setForm(data as Paziente);
    setLoading(false);
  }

  function update<K extends keyof Paziente>(key: K, value: Paziente[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome?.trim() || !form.cognome?.trim()) {
      toast.error("Nome e cognome sono obbligatori");
      return;
    }

    let cf: string | null = null;
    if (form.codice_fiscale && form.codice_fiscale.trim() !== "") {
      const normalized = normalizeCF(form.codice_fiscale);
      const v = validateCFInput(normalized);
      if (!v.ok) {
        toast.error(v.message ?? "Codice fiscale non valido");
        return;
      }
      cf = normalized;
    }

    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      cognome: form.cognome.trim(),
      sesso: form.sesso ?? null,
      data_nascita: form.data_nascita || null,
      luogo_nascita: form.luogo_nascita?.trim() || null,
      codice_fiscale: cf,
      email: form.email?.trim() || null,
      telefono: form.telefono?.trim() || null,
      indirizzo: form.indirizzo?.trim() || null,
      citta: form.citta?.trim() || null,
      cap: form.cap?.trim() || null,
      provincia: form.provincia?.trim().toUpperCase() || null,
      professione: form.professione?.trim() || null,
      note: form.note?.trim() || null,
      peso_kg: form.peso_kg ?? null,
      altezza_cm: form.altezza_cm ?? null,
    };

    if (isNew) {
      const { data, error } = await supabase
        .from("pazienti")
        .insert({ ...payload, created_by: user?.id })
        .select("id")
        .single();
      setSaving(false);
      if (error) {
        toast.error(
          error.code === "23505"
            ? "Esiste già un paziente con questo codice fiscale"
            : `Errore: ${error.message}`,
        );
        return;
      }
      toast.success("Paziente creato");
      void navigate({ to: "/pazienti/$id", params: { id: data.id } });
    } else {
      const { error } = await supabase.from("pazienti").update(payload).eq("id", id);
      setSaving(false);
      if (error) {
        toast.error(
          error.code === "23505"
            ? "Esiste già un paziente con questo codice fiscale"
            : `Errore: ${error.message}`,
        );
        return;
      }
      toast.success("Paziente aggiornato");
      void navigate({ to: "/pazienti/$id", params: { id } });
    }
  }

  async function handleDelete() {
    if (!hasRole("medico")) {
      toast.error("Solo i medici possono eliminare pazienti");
      return;
    }
    if (!confirm("Confermi la cancellazione del paziente? La cartella resta archiviata.")) return;
    const { error } = await supabase
      .from("pazienti")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id })
      .eq("id", id);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    toast.success("Paziente archiviato");
    void navigate({ to: "/pazienti" });
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            isNew
              ? navigate({ to: "/pazienti" })
              : navigate({ to: "/pazienti/$id", params: { id } })
          }
        >
          <ArrowLeft className="h-4 w-4" />
          Indietro
        </Button>
      </div>

      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {isNew ? "Nuovo paziente" : `${form.cognome} ${form.nome}`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isNew
            ? "Compila i dati anagrafici. L'anamnesi viene creata automaticamente."
            : "Modifica i dati anagrafici."}
        </p>
      </header>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Dati anagrafici</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Cognome *" required>
                <Input
                  value={form.cognome ?? ""}
                  onChange={(e) => update("cognome", e.target.value)}
                  required
                />
              </Field>
              <Field label="Nome *" required>
                <Input
                  value={form.nome ?? ""}
                  onChange={(e) => update("nome", e.target.value)}
                  required
                />
              </Field>
              <Field label="Sesso">
                <Select
                  value={form.sesso ?? ""}
                  onValueChange={(v) => update("sesso", (v || null) as Sesso | null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">Femmina</SelectItem>
                    <SelectItem value="M">Maschio</SelectItem>
                    <SelectItem value="altro">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Data di nascita">
                <Input
                  type="date"
                  value={form.data_nascita ?? ""}
                  onChange={(e) => update("data_nascita", e.target.value || null)}
                />
              </Field>
              <Field label="Luogo di nascita">
                <Input
                  value={form.luogo_nascita ?? ""}
                  onChange={(e) => update("luogo_nascita", e.target.value)}
                />
              </Field>
              <Field label="Codice fiscale (opzionale)">
                <Input
                  value={form.codice_fiscale ?? ""}
                  onChange={(e) => update("codice_fiscale", e.target.value.toUpperCase())}
                  maxLength={16}
                  className="font-mono uppercase"
                />
              </Field>
              <Field label="Peso (kg)">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.peso_kg ?? ""}
                  onChange={(e) =>
                    update(
                      "peso_kg",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </Field>
              <Field label="Altezza (cm)">
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={form.altezza_cm ?? ""}
                  onChange={(e) =>
                    update(
                      "altezza_cm",
                      e.target.value === "" ? null : Math.round(Number(e.target.value)),
                    )
                  }
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Contatti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Telefono">
                <Input
                  type="tel"
                  value={form.telefono ?? ""}
                  onChange={(e) => update("telefono", e.target.value)}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => update("email", e.target.value)}
                />
              </Field>
              <Field label="Indirizzo" className="md:col-span-2">
                <Input
                  value={form.indirizzo ?? ""}
                  onChange={(e) => update("indirizzo", e.target.value)}
                />
              </Field>
              <Field label="Città">
                <Input
                  value={form.citta ?? ""}
                  onChange={(e) => update("citta", e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="CAP">
                  <Input
                    value={form.cap ?? ""}
                    onChange={(e) => update("cap", e.target.value)}
                    maxLength={5}
                  />
                </Field>
                <Field label="Prov.">
                  <Input
                    value={form.provincia ?? ""}
                    onChange={(e) => update("provincia", e.target.value.toUpperCase())}
                    maxLength={2}
                    className="uppercase"
                  />
                </Field>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Altro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Professione">
              <Input
                value={form.professione ?? ""}
                onChange={(e) => update("professione", e.target.value)}
              />
            </Field>
            <Field label="Note generali">
              <Textarea
                rows={3}
                value={form.note ?? ""}
                onChange={(e) => update("note", e.target.value)}
                placeholder="Note generali sul paziente (non cliniche)"
              />
            </Field>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {!isNew && hasRole("medico") && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Archivia paziente
              </Button>
            )}
          </div>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Salvataggio…" : isNew ? "Crea paziente" : "Salva modifiche"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className,
  required,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>
        {label}
        {required ? "" : null}
      </Label>
      {children}
    </div>
  );
}
