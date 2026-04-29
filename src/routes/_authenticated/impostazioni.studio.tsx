import * as React from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useStudioInfo } from "@/hooks/use-studio-info";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/impostazioni/studio")({
  component: StudioPage,
});

function StudioPage() {
  const { hasRole, user } = useAuth();
  const { data: studio, isLoading } = useStudioInfo();
  const qc = useQueryClient();

  const [form, setForm] = React.useState({
    ragione_sociale: "",
    partita_iva: "",
    codice_fiscale: "",
    indirizzo: "",
    citta: "",
    cap: "",
    provincia: "",
    telefono: "",
    email: "",
    pec: "",
    sito_web: "",
    direttore_sanitario: "",
  });
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [logoPath, setLogoPath] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (studio) {
      setForm({
        ragione_sociale: studio.ragione_sociale ?? "",
        partita_iva: studio.partita_iva ?? "",
        codice_fiscale: studio.codice_fiscale ?? "",
        indirizzo: studio.indirizzo ?? "",
        citta: studio.citta ?? "",
        cap: studio.cap ?? "",
        provincia: studio.provincia ?? "",
        telefono: studio.telefono ?? "",
        email: studio.email ?? "",
        pec: studio.pec ?? "",
        sito_web: studio.sito_web ?? "",
        direttore_sanitario: studio.direttore_sanitario ?? "",
      });
      setLogoPath(studio.logo_url ?? null);
    }
  }, [studio]);

  React.useEffect(() => {
    if (!logoPath) {
      setLogoUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.storage
        .from("studio-assets")
        .createSignedUrl(logoPath, 3600);
      if (!cancelled) setLogoUrl(data?.signedUrl ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [logoPath]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const salva = useMutation({
    mutationFn: async () => {
      const payload = {
        ragione_sociale: form.ragione_sociale.trim() || null,
        partita_iva: form.partita_iva.trim() || null,
        codice_fiscale: form.codice_fiscale.trim() || null,
        indirizzo: form.indirizzo.trim() || null,
        citta: form.citta.trim() || null,
        cap: form.cap.trim() || null,
        provincia: form.provincia.trim() || null,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        pec: form.pec.trim() || null,
        sito_web: form.sito_web.trim() || null,
        direttore_sanitario: form.direttore_sanitario.trim() || null,
        logo_url: logoPath,
        updated_by: user?.id ?? null,
      };
      if (studio?.id) {
        const { error } = await supabase
          .from("studio_info")
          .update(payload)
          .eq("id", studio.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("studio_info").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Dati studio aggiornati");
      void qc.invalidateQueries({ queryKey: ["studio_info"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onUploadLogo = async (file: File) => {
    const ext = file.name.split(".").pop() ?? "png";
    const path = `logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("studio-assets")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) {
      toast.error(error.message);
      return;
    }
    setLogoPath(path);
    toast.success("Logo caricato. Ricorda di salvare.");
  };

  if (!hasRole("medico")) {
    return <p className="text-sm text-muted-foreground">Sezione riservata ai medici.</p>;
  }
  if (isLoading) return <p className="text-sm text-muted-foreground">Caricamento…</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dati dello studio</CardTitle>
          <CardDescription>Usati nelle intestazioni dei documenti generati.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Ragione sociale" v={form.ragione_sociale} on={(v) => set("ragione_sociale", v)} className="md:col-span-2" />
          <Field label="Partita IVA" v={form.partita_iva} on={(v) => set("partita_iva", v)} />
          <Field label="Codice fiscale" v={form.codice_fiscale} on={(v) => set("codice_fiscale", v)} />
          <Field label="Indirizzo" v={form.indirizzo} on={(v) => set("indirizzo", v)} className="md:col-span-2" />
          <Field label="Città" v={form.citta} on={(v) => set("citta", v)} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="CAP" v={form.cap} on={(v) => set("cap", v)} />
            <Field label="Provincia" v={form.provincia} on={(v) => set("provincia", v)} />
          </div>
          <Field label="Telefono" v={form.telefono} on={(v) => set("telefono", v)} />
          <Field label="Email" v={form.email} on={(v) => set("email", v)} />
          <Field label="PEC" v={form.pec} on={(v) => set("pec", v)} />
          <Field label="Sito web" v={form.sito_web} on={(v) => set("sito_web", v)} />
          <Field label="Direttore sanitario" v={form.direttore_sanitario} on={(v) => set("direttore_sanitario", v)} className="md:col-span-2" />

          <div className="space-y-2 md:col-span-2">
            <Label>Logo</Label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo studio" className="h-16 w-auto rounded border bg-card p-1" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                  Nessuno
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUploadLogo(f);
                }}
                className="max-w-xs"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <Button onClick={() => salva.mutate()} disabled={salva.isPending}>
              {salva.isPending ? "Salvataggio…" : "Salva"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  v,
  on,
  className,
}: {
  label: string;
  v: string;
  on: (v: string) => void;
  className?: string;
}) {
  const id = React.useId();
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}
