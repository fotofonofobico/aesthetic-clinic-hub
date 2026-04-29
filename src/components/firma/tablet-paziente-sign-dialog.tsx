import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ArrowLeft, ArrowRight, FileSignature, Clock, X } from "lucide-react";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import {
  rifiutaFirmaSessione,
  salvaRispostePaziente,
  type FirmaSessioneRow,
  type RispostaDocumento,
} from "@/lib/firma-sessione";

interface Props {
  open: boolean;
  row: FirmaSessioneRow | null;
  onCompleted: () => void;
}

type Scelta = "acconsento" | "non_acconsento";

function formatRemain(ms: number): string {
  if (ms <= 0) return "scaduta";
  const tot = Math.floor(ms / 1000);
  const m = Math.floor(tot / 60);
  const s = tot % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TabletPazienteSignDialog({ open, row, onCompleted }: Props) {
  const docs = useMemo(() => row?.payload?.documenti ?? [], [row]);
  const [step, setStep] = useState(0); // step 0..docs.length-1 per scelte, docs.length per firma
  const [scelte, setScelte] = useState<Record<string, Scelta>>({});
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const padRef = useRef<SignaturePadHandle>(null);

  // Reset alla nuova sessione
  useEffect(() => {
    if (open && row) {
      setStep(0);
      setScelte({});
      padRef.current?.clear();
    }
  }, [open, row?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!open || !row) return null;

  const totalSteps = docs.length + 1; // ultimo step = firma
  const isFirmaStep = step >= docs.length;
  const docCorrente = docs[step];
  const remaining = new Date(row.expires_at).getTime() - now;

  function setScelta(localId: string, s: Scelta) {
    setScelte((p) => ({ ...p, [localId]: s }));
  }

  function avanti() {
    if (!docCorrente) return;
    if (!scelte[docCorrente.localId]) {
      toast.error("Seleziona Acconsento o Non acconsento");
      return;
    }
    // Vincolo GDPR
    if (docCorrente.kind.kind === "gdpr" && scelte[docCorrente.localId] === "non_acconsento") {
      toast.error("Il consenso GDPR/Privacy è obbligatorio per proseguire");
      return;
    }
    setStep((s) => s + 1);
  }

  function indietro() {
    setStep((s) => Math.max(0, s - 1));
  }

  async function conferma() {
    if (!row) return;
    const sessId = row.id;
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      toast.error("Apponi la firma prima di confermare");
      return;
    }
    const firma = pad.toDataURL();

    const tuttiRifiutati = docs.every((d) => scelte[d.localId] === "non_acconsento");
    setSaving(true);
    try {
      if (tuttiRifiutati) {
        await rifiutaFirmaSessione(sessId, "Paziente ha rifiutato tutti i documenti");
      } else {
        const risposte: RispostaDocumento[] = docs.map((d) => ({
          localId: d.localId,
          scelta: scelte[d.localId],
          firmaPaziente: scelte[d.localId] === "acconsento" ? firma : null,
        }));
        const res = await salvaRispostePaziente(sessId, risposte);
        if (res.error) throw new Error(res.error);
      }
      toast.success("Firma inviata al medico");
      onCompleted();
    } catch (e) {
      toast.error(`Errore invio: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function annullaSessione() {
    if (!row) return;
    setSaving(true);
    try {
      await rifiutaFirmaSessione(row.id, "Sessione interrotta dal tablet");
      onCompleted();
    } finally {
      setSaving(false);
      setConfirmCloseOpen(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && setConfirmCloseOpen(true)}>
        <DialogContent
          aria-describedby={undefined}
          className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[95vh] sm:w-full sm:!max-w-3xl sm:rounded-xl [&>button]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            setConfirmCloseOpen(true);
          }}
        >
          {/* Header tablet */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <FileSignature className="h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" />
              <div className="min-w-0">
                <p className="font-display truncate text-base font-semibold leading-tight sm:text-lg">
                  {isFirmaStep ? "Firma" : `Documento ${step + 1} di ${docs.length}`}
                </p>
                <p className="truncate text-xs text-muted-foreground">{row.payload.pazienteNome}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 font-mono text-xs tabular-nums sm:flex">
                <Clock className="h-3.5 w-3.5" />
                {formatRemain(remaining)}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => setConfirmCloseOpen(true)}
                disabled={saving}
                aria-label="Chiudi sessione"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Countdown su mobile (sotto header) */}
          <div className="flex shrink-0 items-center justify-end border-b border-border bg-card px-4 py-1.5 sm:hidden">
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 font-mono text-[11px] tabular-nums">
              <Clock className="h-3 w-3" />
              {formatRemain(remaining)}
            </div>
          </div>

          {/* Body scrollabile */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!isFirmaStep && docCorrente && (
              <div className="space-y-4 px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5">
                <div>
                  <h2 className="font-display text-xl font-semibold sm:text-2xl">{docCorrente.titolo}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Versione {docCorrente.versione}
                  </p>
                </div>
                <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-card p-3 text-sm leading-relaxed sm:p-4">
                  {docCorrente.testo}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setScelta(docCorrente.localId, "acconsento")}
                    className={`flex min-h-[56px] items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-semibold transition-all ${
                      scelte[docCorrente.localId] === "acconsento"
                        ? "border-success bg-success/10 text-success"
                        : "border-border bg-card text-foreground hover:border-success/50"
                    }`}
                  >
                    <CheckCircle2 className="h-6 w-6" />
                    Acconsento
                  </button>
                  <button
                    type="button"
                    onClick={() => setScelta(docCorrente.localId, "non_acconsento")}
                    className={`flex min-h-[56px] items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-semibold transition-all ${
                      scelte[docCorrente.localId] === "non_acconsento"
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-border bg-card text-foreground hover:border-destructive/50"
                    }`}
                  >
                    <XCircle className="h-6 w-6" />
                    Non acconsento
                  </button>
                </div>
              </div>
            )}

            {isFirmaStep && (
              <div className="space-y-4 px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5">
                <div>
                  <h2 className="font-display text-xl font-semibold sm:text-2xl">Apponi la firma</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Una sola firma vale per tutti i documenti accettati.
                  </p>
                </div>
                {/* Riepilogo */}
                <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
                  {docs.map((d) => (
                    <div key={d.localId} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate pr-2">{d.titolo}</span>
                      {scelte[d.localId] === "acconsento" ? (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Acconsento
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-destructive">
                          <XCircle className="h-3.5 w-3.5" /> Non acconsento
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <SignaturePad ref={padRef} height={220} />
              </div>
            )}
          </div>

          {/* Footer fisso */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
            <Button
              variant="outline"
              size="default"
              onClick={indietro}
              disabled={step === 0 || saving}
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Indietro</span>
            </Button>

            <div className="text-[11px] text-muted-foreground sm:text-xs">
              Step {Math.min(step + 1, totalSteps)} di {totalSteps}
            </div>

            {!isFirmaStep ? (
              <Button size="default" onClick={avanti} disabled={saving}>
                Avanti
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            ) : (
              <Button size="default" onClick={conferma} disabled={saving}>
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Conferma firma</span>
                <span className="sm:hidden">Conferma</span>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Interrompere la sessione di firma?</AlertDialogTitle>
            <AlertDialogDescription>
              Le scelte e l'eventuale firma non verranno inviate al medico. La sessione sarà
              annullata e potrai riceverne una nuova.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Continua a firmare</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void annullaSessione();
              }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Interrompi sessione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
