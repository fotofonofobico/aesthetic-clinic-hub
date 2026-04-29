import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/impostazioni/preferenze")({
  component: PreferenzePage,
});

interface Pref {
  user_id: string;
  vista_default: string;
  followup_auto_attivo: boolean;
  followup_giorni_offset: number;
}

function PreferenzePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: pref, isLoading } = useQuery({
    queryKey: ["calendario_preferenze", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Pref | null> => {
      const { data, error } = await supabase
        .from("calendario_preferenze")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Pref | null;
    },
  });

  const [vista, setVista] = React.useState("settimana");
  const [auto, setAuto] = React.useState(false);
  const [offset, setOffset] = React.useState(7);

  React.useEffect(() => {
    if (pref) {
      setVista(pref.vista_default);
      setAuto(pref.followup_auto_attivo);
      setOffset(pref.followup_giorni_offset);
    }
  }, [pref]);

  const salva = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("non auth");
      const payload = {
        user_id: user.id,
        vista_default: vista,
        followup_auto_attivo: auto,
        followup_giorni_offset: offset,
      };
      if (pref) {
        const { error } = await supabase
          .from("calendario_preferenze")
          .update(payload)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("calendario_preferenze").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Preferenze salvate");
      void qc.invalidateQueries({ queryKey: ["calendario_preferenze"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Caricamento…</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendario</CardTitle>
          <CardDescription>Vista predefinita e gestione follow-up.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vista predefinita</Label>
            <Select value={vista} onValueChange={setVista}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="giorno">Giorno</SelectItem>
                <SelectItem value="settimana">Settimana</SelectItem>
                <SelectItem value="mese">Mese</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Follow-up automatico</p>
              <p className="text-xs text-muted-foreground">
                Crea promemoria nel calendario dopo ogni seduta completata.
              </p>
            </div>
            <Switch checked={auto} onCheckedChange={setAuto} />
          </div>

          <div className="space-y-2">
            <Label>Offset follow-up (giorni)</Label>
            <Input
              type="number"
              min={1}
              max={90}
              value={offset}
              onChange={(e) => setOffset(Math.max(1, Number(e.target.value) || 1))}
              className="w-32"
              disabled={!auto}
            />
          </div>

          <Button onClick={() => salva.mutate()} disabled={salva.isPending}>
            {salva.isPending ? "Salvataggio…" : "Salva preferenze"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
