import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Syringe, Loader2 } from "lucide-react";
import { buildTrattamentoSession, type SignatureSession } from "@/lib/signature-session";
import { SignatureSessionDialog } from "@/components/signature-session-dialog";
import { SendToTabletButton } from "@/components/firma/send-to-tablet-button";
import { TabletSessionRunner } from "@/components/firma/tablet-session-runner";
import { logger } from "@/lib/logger";

interface TrattamentoLite {
  id: string;
  nome: string;
  categoria: string | null;
}

interface Props {
  pazienteId: string;
  pazienteNome?: string;
  onCompleted?: () => void;
}

export function FirmaTrattamentoLauncher({ pazienteId, pazienteNome = "", onCompleted }: Props) {
  const [openSel, setOpenSel] = useState(false);
  const [trattamenti, setTrattamenti] = useState<TrattamentoLite[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [building, setBuilding] = useState(false);
  const [session, setSession] = useState<SignatureSession | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [tabletSession, setTabletSession] = useState<SignatureSession | null>(null);

  useEffect(() => {
    if (!openSel) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("trattamenti")
          .select("id, nome, categoria")
          .eq("attivo", true)
          .order("nome");
        if (!cancelled) setTrattamenti((data ?? []) as TrattamentoLite[]);
      } catch (err) {
        logger.error("[firmaTrattamentoLauncher]", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openSel]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function avvia() {
    if (selected.size === 0) {
      toast.error("Seleziona almeno un trattamento");
      return;
    }
    setBuilding(true);
    const s = await buildTrattamentoSession(pazienteId, Array.from(selected));
    setBuilding(false);
    if (!s || s.documenti.length === 0) {
      toast.success("Tutti i consensi richiesti sono già validi");
      setOpenSel(false);
      setSelected(new Set());
      return;
    }
    setSession(s);
    setOpenSel(false);
    setSessionOpen(true);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpenSel(true)}>
        <Syringe className="h-4 w-4" />
        Firma trattamento
      </Button>

      <Dialog open={openSel} onOpenChange={setOpenSel}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              Seleziona trattamenti da eseguire
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {trattamenti.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun trattamento attivo.</p>
            ) : (
              <div className="max-h-[50vh] space-y-1 overflow-auto">
                {trattamenti.map((t) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 hover:bg-accent/30"
                  >
                    <Checkbox
                      checked={selected.has(t.id)}
                      onCheckedChange={() => toggle(t.id)}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{t.nome}</div>
                      {t.categoria && (
                        <div className="text-xs text-muted-foreground">{t.categoria}</div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Verranno richiesti solo i consensi mancanti, scaduti o legati alla seduta.
            </p>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setOpenSel(false)}>
              Annulla
            </Button>
            <SendToTabletButton
              session={null}
              pazienteNome=""
              label="Invia a tablet"
              disabled={building || selected.size === 0}
              buildSession={async () => {
                setBuilding(true);
                const s = await buildTrattamentoSession(pazienteId, Array.from(selected));
                setBuilding(false);
                if (s) setOpenSel(false);
                return s;
              }}
              onCompleted={() => {
                setSelected(new Set());
                onCompleted?.();
              }}
            />
            <Button onClick={() => void avvia()} disabled={building || selected.size === 0}>
              {building ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifica consensi…
                </>
              ) : (
                <>Firma sul Mac</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignatureSessionDialog
        open={sessionOpen}
        session={session}
        pazienteNome={pazienteNome}
        onClose={() => setSessionOpen(false)}
        onCompleted={() => {
          setSessionOpen(false);
          setSelected(new Set());
          onCompleted?.();
        }}
        onInviaTablet={(s) => setTabletSession(s)}
      />

      <TabletSessionRunner
        session={tabletSession}
        pazienteNome={pazienteNome}
        onClose={() => setTabletSession(null)}
        onCompleted={() => {
          setTabletSession(null);
          setSelected(new Set());
          onCompleted?.();
        }}
      />
    </>
  );
}
