import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Tablet, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useFirmaSessione, annullaFirmaSessione, type FirmaSessioneRow } from "@/lib/firma-sessione";

interface Props {
  open: boolean;
  sessionId: string | null;
  pazienteNome: string;
  onSigned: (row: FirmaSessioneRow) => void;
  onClose: () => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const tot = Math.floor(ms / 1000);
  const m = Math.floor(tot / 60);
  const s = tot % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function WaitForTabletDialog({ open, sessionId, pazienteNome, onSigned, onClose }: Props) {
  const { row } = useFirmaSessione(open ? sessionId : null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  // Quando lo stato diventa signed, propaga al chiamante (una sola volta)
  useEffect(() => {
    if (row?.stato === "signed") {
      onSigned(row);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.stato]);

  const expiresAt = row ? new Date(row.expires_at).getTime() : 0;
  const remaining = expiresAt - now;

  async function handleAnnulla() {
    if (sessionId) await annullaFirmaSessione(sessionId);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Tablet className="h-5 w-5" />
            In attesa di firma sul tablet
          </DialogTitle>
        </DialogHeader>

        {!row && (
          <div className="flex items-center gap-3 py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Creazione sessione…</span>
          </div>
        )}

        {row?.stato === "pending" && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border bg-card p-4 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-sm font-medium">
                Consegna l'iPad a <span className="font-semibold">{pazienteNome}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Il documento è già visibile sul dispositivo in modalità firma.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="text-muted-foreground">Sessione valida ancora:</span>
              <span className="font-mono font-semibold tabular-nums">
                {formatCountdown(remaining)}
              </span>
            </div>
            <Button variant="outline" className="w-full" onClick={handleAnnulla}>
              <X className="h-4 w-4" />
              Annulla sessione
            </Button>
          </div>
        )}

        {row?.stato === "signed" && (
          <div className="space-y-3 py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="text-sm">Firma ricevuta dal tablet.</p>
            <p className="text-xs text-muted-foreground">Apertura finalizzazione…</p>
          </div>
        )}

        {row?.stato === "refused" && (
          <div className="space-y-3 py-4">
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
              <div className="text-sm">
                <p className="font-medium">Il paziente ha rifiutato di firmare</p>
                {row.rifiuto_motivo && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Motivo: {row.rifiuto_motivo}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Chiudi
            </Button>
          </div>
        )}

        {row?.stato === "expired" && (
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              Sessione scaduta. Riprova creandone una nuova.
            </p>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Chiudi
            </Button>
          </div>
        )}

        {row?.stato === "cancelled" && (
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">Sessione annullata.</p>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Chiudi
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
