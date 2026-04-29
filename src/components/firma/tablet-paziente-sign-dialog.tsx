import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ArrowLeft, ArrowRight, FileSignature, Clock } from "lucide-react";
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

  return (
    <Dialog open={open}>
      <DialogContent
        className="!max-w-3xl max-h-[95vh] overflow-y-auto p-0 sm:rounded-xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header tablet */}
        <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <FileSignature className="h-6 w-6 text-primary" />
            <div>
              <p className="font-display text-lg font-semibold leading-tight">
                {isFirmaStep ? "Firma" : `Documento ${step + 1} di ${docs.length}`}
              </p>
              <p className="text-xs text-muted-foreground">{row.payload.pazienteNome}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-mono tabular-nums">
            <Clock className="h-3.5 w-3.5" />
            {formatRemain(remaining)}
          </div>
        </div>

        {/* Body */}
        {!isFirmaStep && docCorrente && (
          <div className="space-y-5 px-6 py-5">
            <div>
              <h2 className="font-display text-2xl font-semibold">{docCorrente.titolo}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Versione {docCorrente.versione}
              </p>
            </div>
            <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-sm leading-relaxed">
              {docCorrente.testo}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setScelta(docCorrente.localId, "acconsento")}
                className={`flex min-h-[64px] items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-semibold transition-all ${
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
                className={`flex min-h-[64px] items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-semibold transition-all ${
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
          <div className="space-y-5 px-6 py-5">
            <div>
              <h2 className="font-display text-2xl font-semibold">Apponi la firma</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Una sola firma vale per tutti i documenti accettati.
              </p>
            </div>
            {/* Riepilogo */}
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
              {docs.map((d) => (
                <div key={d.localId} className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{d.titolo}</span>
                  {scelte[d.localId] === "acconsento" ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Acconsento
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                      <XCircle className="h-3.5 w-3.5" /> Non acconsento
                    </span>
                  )}
                </div>
              ))}
            </div>
            <SignaturePad ref={padRef} height={280} />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-6 py-4">
          <Button
            variant="outline"
            size="lg"
            onClick={indietro}
            disabled={step === 0 || saving}
          >
            <ArrowLeft className="h-5 w-5" />
            Indietro
          </Button>

          <div className="text-xs text-muted-foreground">
            Step {Math.min(step + 1, totalSteps)} di {totalSteps}
          </div>

          {!isFirmaStep ? (
            <Button size="lg" onClick={avanti} disabled={saving}>
              Avanti
              <ArrowRight className="h-5 w-5" />
            </Button>
          ) : (
            <Button size="lg" onClick={conferma} disabled={saving}>
              <CheckCircle2 className="h-5 w-5" />
              Conferma firma
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
