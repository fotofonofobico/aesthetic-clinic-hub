import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, FileSignature } from "lucide-react";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { useAuth } from "@/lib/auth-context";
import { marcaConsumed, type FirmaSessioneRow, type RispostaDocumento } from "@/lib/firma-sessione";
import {
  caricaOperatoreNome,
  salvaSessioneFirme,
} from "@/lib/signature-session-save";
import type { SessionDoc, SignatureSession } from "@/lib/signature-session";

interface Props {
  open: boolean;
  row: FirmaSessioneRow | null;
  onCompleted: () => void;
  onClose: () => void;
}

export function MedicoFinalizeDialog({ open, row, onCompleted, onClose }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  // Map localId -> dataURL firma medico
  const [firmeMedico, setFirmeMedico] = useState<Record<string, string>>({});
  const padRefs = useRef<Record<string, SignaturePadHandle | null>>({});

  // Documenti e risposte estratti dal payload
  const docs = useMemo<SessionDoc[]>(() => row?.payload?.documenti ?? [], [row]);
  const risposte: RispostaDocumento[] = row?.acconsensi?.risposte ?? [];

  // La firma del medico è stata rimossa da tutti i documenti: nessun pad da
  // mostrare. Manteniamo lo stato dei refs per retrocompatibilità.
  const docsCheServonoFirmaMedico = useMemo<SessionDoc[]>(() => [], []);

  useEffect(() => {
    if (!open) {
      setFirmeMedico({});
      padRefs.current = {};
    }
  }, [open]);

  if (!open || !row) return null;

  async function handleConferma() {
    if (!row || !user) return;

    // Verifica firme medico necessarie
    for (const d of docsCheServonoFirmaMedico) {
      const pad = padRefs.current[d.localId];
      if (!pad || pad.isEmpty()) {
        toast.error(`Firma del medico mancante per "${d.titolo}"`);
        return;
      }
      firmeMedico[d.localId] = pad.toDataURL();
    }

    setSaving(true);
    try {
      // Componi finalDocs con firme paziente (dalla sessione) + firme medico (locali)
      const finalDocs: SessionDoc[] = docs.map((d) => {
        const r = risposte.find((x) => x.localId === d.localId);
        const firmaMed = d.richiedeFirmaMedico && r?.scelta === "acconsento"
          ? firmeMedico[d.localId] ?? null
          : null;
        return {
          ...d,
          scelta: r?.scelta,
          firmaPaziente: r?.firmaPaziente ?? null,
          firmaMedico: firmaMed,
          completato: !!r,
        };
      });

      const operatoreNome = await caricaOperatoreNome(user.id);

      const sessionForSave: SignatureSession = {
        tipo: row.payload.tipo,
        pazienteId: row.paziente_id,
        documenti: finalDocs,
      };

      await salvaSessioneFirme(sessionForSave, finalDocs, {
        userId: user.id,
        operatoreNome,
        modalitaFirma: "tablet",
      });

      await marcaConsumed(row.id);
      toast.success("Sessione firma completata");
      onCompleted();
    } catch (e) {
      toast.error(`Errore salvataggio: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <DialogContent className="max-h-[95vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            Finalizza sessione firma
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Il paziente ha già firmato sul tablet. Verifica le scelte e — se richiesto — apponi la firma del medico.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Riepilogo scelte paziente */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Risposte del paziente
            </p>
            {docs.map((d) => {
              const r = risposte.find((x) => x.localId === d.localId);
              const acc = r?.scelta === "acconsento";
              return (
                <div
                  key={d.localId}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.titolo}</p>
                    <p className="text-xs text-muted-foreground">v{d.versione}</p>
                  </div>
                  {acc ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      Acconsento
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                      <XCircle className="h-4 w-4" />
                      Non acconsento
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Firme medico richieste */}
          {docsCheServonoFirmaMedico.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Firma del medico richiesta
              </p>
              {docsCheServonoFirmaMedico.map((d) => (
                <div key={d.localId} className="rounded-lg border border-border bg-card p-3">
                  <p className="mb-2 text-sm font-medium">{d.titolo}</p>
                  <SignaturePad
                    ref={(r) => {
                      padRefs.current[d.localId] = r;
                    }}
                    height={160}
                  />
                </div>
              ))}
            </div>
          )}

          {docsCheServonoFirmaMedico.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nessuna firma del medico richiesta. Conferma per salvare.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={handleConferma} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Conferma e salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
