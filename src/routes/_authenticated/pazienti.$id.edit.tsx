import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { confirmDialog } from "@/lib/confirm-dialog";
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
import { validateCFInput, normalizeCF, decodeCF } from "@/lib/codice-fiscale";
import { useStudi } from "@/hooks/use-studi";
import type { Paziente, Sesso } from "@/types/clinico";
import {
  pazienteToFormValues,
  formValuesToPazientePayload,
  type PazienteFormValues,
} from "@/services/pazienti/patient.form";

export const Route = createFileRoute("/_authenticated/pazienti/$id/edit")({
  component: PazienteEditPage,
});

function PazienteEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isNew = id === "new";
  const { data: studi } = useStudi();
  const studiAttivi = (studi ?? []).filter((s) => s.attivo);
  const mostraSelettoreStudio = (studi ?? []).length >= 2;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PazienteFormValues>({
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
    studio_id: null,
  });

  // Per i nuovi pazienti, precompila con lo studio attivo del profilo
  useEffect(() => {
    if (!isNew || !user?.id) return;
    void supabase
      .from("profiles")
      .select("studio_attivo_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const sid = (data?.studio_attivo_id as string | null) ?? null;
        if (sid) setForm((f) => (f.studio_id ? f : { ...f, studio_id: sid }));
      });
  }, [isNew, user?.id]);

  useEffect(() => {
    if (isNew) return;
    void load();
  }, [id]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("pazienti").select("*").eq("id", id).maybeSingle();
    if (error || !data) {
      toast.error("Paziente non trovato");
      void navigate({ to: "/pazienti" });
      return;
    }
    setForm(pazienteToFormValues(data as Paziente));
    setLoading(false);
  }

  function update<K extends keyof PazienteFormValues>(key: K, value: PazienteFormValues[K]) {
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
    // Il codice fiscale validato/normalizzato sopra sostituisce sempre quello
    // grezzo del form: il mapper non contiene logica di validazione del CF.
    // peso_kg/altezza_cm gestiti esclusivamente dalla card Misurazioni in Anamnesi (sync via trigger DB)
    const payload = { ...formValuesToPazientePayload(form), codice_fiscale: cf };

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
    const ok = await confirmDialog({
      title: "Eliminare paziente",
      description: "Confermi la cancellazione del paziente? La cartella resta archiviata.",
      destructive: true,
    });
    if (!ok) return;
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
                  onChange={(e) => {
                    const upper = e.target.value.toUpperCase();
                    setForm((f) => {
                      const next = { ...f, codice_fiscale: upper };
                      if (upper.length === 16) {
                        const decoded = decodeCF(upper);
                        if (decoded) {
                          if (!f.data_nascita) next.data_nascita = decoded.dataNascita;
                          if (!f.sesso) next.sesso = decoded.sesso as Sesso;
                        }
                      }
                      return next;
                    });
                  }}
                  maxLength={16}
                  className="font-mono uppercase"
                />
                <p className="text-[11px] text-muted-foreground">
                  Data di nascita e sesso vengono compilati automaticamente
                </p>
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
                <Input value={form.citta ?? ""} onChange={(e) => update("citta", e.target.value)} />
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
            {mostraSelettoreStudio ? (
              <Field label="Studio di riferimento">
                <Select
                  value={form.studio_id ?? "none"}
                  onValueChange={(v) => update("studio_id", v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {studiAttivi.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome}
                        {s.citta ? ` · ${s.citta}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
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
