import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { History, Eye } from "lucide-react";
import type { AnamnesiVersione } from "@/types/clinico";

interface ProfileRow {
  user_id: string;
  nome: string | null;
  cognome: string | null;
}

export function AnamnesiCronologia({ pazienteId }: { pazienteId: string }) {
  const [versioni, setVersioni] = useState<AnamnesiVersione[]>([]);
  const [profili, setProfili] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<AnamnesiVersione | null>(null);

  useEffect(() => {
    void load();
  }, [pazienteId]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("anamnesi_versione")
      .select("*")
      .eq("paziente_id", pazienteId)
      .order("created_at", { ascending: false });

    const list = (data ?? []) as unknown as AnamnesiVersione[];
    setVersioni(list);

    const userIds = Array.from(
      new Set(list.map((v) => v.created_by).filter((x): x is string => !!x)),
    );
    if (userIds.length > 0) {
      const { data: pData } = await supabase
        .from("profiles")
        .select("user_id, nome, cognome")
        .in("user_id", userIds);
      const map: Record<string, ProfileRow> = {};
      (pData ?? []).forEach((p) => {
        map[p.user_id] = p as ProfileRow;
      });
      setProfili(map);
    }
    setLoading(false);
  }

  function nomeOperatore(uid: string | null) {
    if (!uid) return "—";
    const p = profili[uid];
    if (!p) return "Operatore sconosciuto";
    return `${p.nome ?? ""} ${p.cognome ?? ""}`.trim() || "Operatore";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <History className="h-4 w-4" />
          Cronologia anamnesi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Caricamento…</p>
        ) : versioni.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessuna versione precedente. La prima fotografia verrà creata al prossimo
            salvataggio.
          </p>
        ) : (
          <ul className="space-y-2">
            {versioni.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {new Date(v.created_at).toLocaleString("it-IT", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {nomeOperatore(v.created_by)}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setViewing(v)}>
                  <Eye className="h-4 w-4" />
                  Vedi
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              Versione del{" "}
              {viewing
                ? new Date(viewing.created_at).toLocaleString("it-IT", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : ""}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(viewing.snapshot, null, 2)}
            </pre>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
