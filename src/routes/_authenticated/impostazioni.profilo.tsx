import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useProfile } from "@/hooks/use-profile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/impostazioni/profilo")({
  component: ProfiloPage,
});

function ProfiloPage() {
  const { user, signOut } = useAuth();
  const { data: profilo, isLoading } = useProfile();
  const qc = useQueryClient();

  const [nome, setNome] = React.useState("");
  const [cognome, setCognome] = React.useState("");
  const [telefono, setTelefono] = React.useState("");
  const [qualifica, setQualifica] = React.useState("");
  const [numeroAlbo, setNumeroAlbo] = React.useState("");

  React.useEffect(() => {
    if (profilo) {
      setNome(profilo.nome ?? "");
      setCognome(profilo.cognome ?? "");
      setTelefono(profilo.telefono ?? "");
      setQualifica(profilo.qualifica ?? "");
      setNumeroAlbo(profilo.numero_albo ?? "");
    }
  }, [profilo]);

  const salva = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Utente non autenticato");
      const { error } = await supabase
        .from("profiles")
        .update({
          nome: nome.trim(),
          cognome: cognome.trim(),
          telefono: telefono.trim() || null,
          qualifica: qualifica.trim() || null,
          numero_albo: numeroAlbo.trim() || null,
        })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profilo aggiornato");
      void qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [pwd, setPwd] = React.useState("");
  const [pwd2, setPwd2] = React.useState("");
  const cambiaPwd = useMutation({
    mutationFn: async () => {
      if (pwd.length < 8) throw new Error("Minimo 8 caratteri");
      if (pwd !== pwd2) throw new Error("Le password non coincidono");
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password aggiornata");
      setPwd("");
      setPwd2("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Caricamento…</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Dati personali</CardTitle>
          <CardDescription>Email: {user?.email}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cognome">Cognome</Label>
            <Input id="cognome" value={cognome} onChange={(e) => setCognome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qualifica">Qualifica</Label>
            <Input
              id="qualifica"
              value={qualifica}
              onChange={(e) => setQualifica(e.target.value)}
              placeholder="Es. Medico estetico, Infermiere…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="albo">Numero albo</Label>
            <Input id="albo" value={numeroAlbo} onChange={(e) => setNumeroAlbo(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="tel">Telefono</Label>
            <Input id="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => salva.mutate()} disabled={salva.isPending}>
              {salva.isPending ? "Salvataggio…" : "Salva modifiche"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cambio password</CardTitle>
          <CardDescription>Almeno 8 caratteri.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pwd">Nuova password</Label>
            <Input id="pwd" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd2">Conferma</Label>
            <Input id="pwd2" type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button
              variant="secondary"
              onClick={() => cambiaPwd.mutate()}
              disabled={cambiaPwd.isPending || !pwd}
            >
              {cambiaPwd.isPending ? "Aggiornamento…" : "Aggiorna password"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessione</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => void signOut()}>
            Esci dall'account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
