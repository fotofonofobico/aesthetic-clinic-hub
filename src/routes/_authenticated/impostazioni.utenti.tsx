import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/impostazioni/utenti")({
  component: UtentiPage,
});

interface UtenteRiga {
  user_id: string;
  nome: string;
  cognome: string;
  qualifica: string | null;
  attivo: boolean;
  ruolo: AppRole | null;
}

function UtentiPage() {
  const { hasRole, user: meUser } = useAuth();
  const qc = useQueryClient();

  const { data: utenti, isLoading } = useQuery({
    queryKey: ["utenti_admin"],
    enabled: hasRole("medico"),
    queryFn: async (): Promise<UtenteRiga[]> => {
      const [{ data: profili, error: e1 }, { data: ruoli, error: e2 }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, nome, cognome, qualifica, attivo")
          .order("cognome", { ascending: true }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const ruoloMap = new Map<string, AppRole>();
      (ruoli ?? []).forEach((r) => ruoloMap.set(r.user_id as string, r.role as AppRole));
      return (profili ?? []).map((p) => ({
        user_id: p.user_id as string,
        nome: p.nome ?? "",
        cognome: p.cognome ?? "",
        qualifica: p.qualifica,
        attivo: p.attivo,
        ruolo: ruoloMap.get(p.user_id as string) ?? null,
      }));
    },
  });

  const cambiaRuolo = useMutation({
    mutationFn: async ({ userId, nuovo }: { userId: string; nuovo: AppRole }) => {
      // Elimina ruoli esistenti, inserisci il nuovo
      const { error: eDel } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (eDel) throw eDel;
      const { error: eIns } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: nuovo });
      if (eIns) throw eIns;
      // Audit
      await supabase.from("audit_log").insert({
        user_id: meUser?.id,
        action: "role_change",
        entity_type: "user",
        entity_id: userId,
        metadata: { nuovo_ruolo: nuovo },
      });
    },
    onSuccess: () => {
      toast.success("Ruolo aggiornato");
      void qc.invalidateQueries({ queryKey: ["utenti_admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cambiaAttivo = useMutation({
    mutationFn: async ({ userId, attivo }: { userId: string; attivo: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ attivo })
        .eq("user_id", userId);
      if (error) throw error;
      await supabase.from("audit_log").insert({
        user_id: meUser?.id,
        action: attivo ? "user_activated" : "user_deactivated",
        entity_type: "user",
        entity_id: userId,
      });
    },
    onSuccess: () => {
      toast.success("Stato utente aggiornato");
      void qc.invalidateQueries({ queryKey: ["utenti_admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!hasRole("medico")) {
    return <p className="text-sm text-muted-foreground">Sezione riservata ai medici.</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Utenti & Ruoli</CardTitle>
          <CardDescription>
            I nuovi utenti si registrano dalla pagina di accesso. Da qui puoi assegnare il ruolo
            e attivare/disattivare un account. Sono disponibili due ruoli: <b>Medico</b> (admin)
            e <b>Collaboratore</b> (standard).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Caricamento…</p>
          ) : !utenti?.length ? (
            <p className="text-sm text-muted-foreground">Nessun utente.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b">
                    <th className="py-2 pr-4">Utente</th>
                    <th className="py-2 pr-4">Qualifica</th>
                    <th className="py-2 pr-4">Ruolo</th>
                    <th className="py-2 pr-4">Attivo</th>
                  </tr>
                </thead>
                <tbody>
                  {utenti.map((u) => {
                    const isMe = u.user_id === meUser?.id;
                    return (
                      <tr key={u.user_id} className="border-b last:border-0">
                        <td className="py-3 pr-4">
                          <div className="font-medium">
                            {u.nome} {u.cognome} {isMe && <Badge variant="outline" className="ml-2">tu</Badge>}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {u.qualifica ?? "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <Select
                            value={u.ruolo ?? "collaboratore"}
                            onValueChange={(v) =>
                              cambiaRuolo.mutate({ userId: u.user_id, nuovo: v as AppRole })
                            }
                            disabled={isMe}
                          >
                            <SelectTrigger className="w-44">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="medico">Medico</SelectItem>
                              <SelectItem value="collaboratore">Collaboratore</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 pr-4">
                          <Switch
                            checked={u.attivo}
                            disabled={isMe}
                            onCheckedChange={(v) =>
                              cambiaAttivo.mutate({ userId: u.user_id, attivo: v })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Non puoi modificare ruolo o stato del tuo stesso account.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
