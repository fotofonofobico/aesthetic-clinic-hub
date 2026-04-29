import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tablet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  creaFirmaSessione,
  type FirmaSessioneRow,
} from "@/lib/firma-sessione";
import type { SignatureSession } from "@/lib/signature-session";
import { WaitForTabletDialog } from "@/components/firma/wait-for-tablet-dialog";
import { MedicoFinalizeDialog } from "@/components/firma/medico-finalize-dialog";

interface Props {
  /** Sessione firma già costruita (può essere null fino a quando non è pronta). */
  session: SignatureSession | null;
  pazienteNome: string;
  /** Etichetta override (es. "Invia a tablet — Anamnesi"). */
  label?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
  disabled?: boolean;
  /** Pre-step: costruisci la sessione lazy (es. dopo selezione trattamenti). */
  buildSession?: () => Promise<SignatureSession | null>;
  onSent?: () => void;
  onCompleted?: () => void;

  /**
   * Modalità "headless": non rendere il bottone trigger. Quando questa prop
   * diventa una sessione non-null, parte automaticamente il flusso di invio
   * al tablet. Utile per montare il runner fuori dal SignatureSessionDialog
   * così che la chiusura del dialog non smonti i listener Realtime.
   */
  controlledSession?: SignatureSession | null;
  /** Chiamato quando il flusso headless si chiude (per qualunque motivo). */
  onControlledClose?: () => void;
}

/**
 * Bottone "Invia a tablet" che incapsula:
 *  - creazione firma_sessione
 *  - dialog di attesa con countdown
 *  - dialog di finalizzazione (firma medico + salvataggio)
 *
 * Supporta anche una modalità "headless" guidata da `controlledSession`.
 */
export function SendToTabletButton({
  session,
  pazienteNome,
  label = "Invia a tablet",
  variant = "outline",
  size = "default",
  disabled,
  buildSession,
  onSent,
  onCompleted,
  controlledSession,
  onControlledClose,
}: Props) {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [waitOpen, setWaitOpen] = useState(false);
  const [signedRow, setSignedRow] = useState<FirmaSessioneRow | null>(null);
  const headless = controlledSession !== undefined;

  async function startWith(finalSession: SignatureSession | null) {
    if (!user) {
      toast.error("Sessione non valida");
      return;
    }
    if (!finalSession || finalSession.documenti.length === 0) {
      toast.success("Nessun documento da firmare");
      return;
    }
    const res = await creaFirmaSessione(finalSession, pazienteNome, user.id);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    setSessionId(res.id);
    setWaitOpen(true);
    onSent?.();
  }

  async function handleClick() {
    setCreating(true);
    try {
      const finalSession = buildSession ? await buildSession() : session;
      await startWith(finalSession);
    } finally {
      setCreating(false);
    }
  }

  // Avvio automatico in modalità headless quando arriva una controlledSession
  useEffect(() => {
    if (!headless) return;
    if (!controlledSession) return;
    if (sessionId || waitOpen || signedRow) return; // già in corso
    void startWith(controlledSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledSession]);

  function handleSigned(row: FirmaSessioneRow) {
    setWaitOpen(false);
    setSignedRow(row);
  }

  function reset() {
    setSessionId(null);
    setSignedRow(null);
    setWaitOpen(false);
    if (headless) onControlledClose?.();
  }

  return (
    <>
      {!headless && (
        <Button
          variant={variant}
          size={size}
          onClick={() => void handleClick()}
          disabled={disabled || creating}
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tablet className="h-4 w-4" />}
          {label}
        </Button>
      )}

      <WaitForTabletDialog
        open={waitOpen}
        sessionId={sessionId}
        pazienteNome={pazienteNome}
        onSigned={handleSigned}
        onClose={reset}
      />

      <MedicoFinalizeDialog
        open={!!signedRow}
        row={signedRow}
        onCompleted={() => {
          reset();
          onCompleted?.();
        }}
        onClose={reset}
      />
    </>
  );
}
