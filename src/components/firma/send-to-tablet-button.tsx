import { useState } from "react";
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
}

/**
 * Bottone "📱 Invia a tablet" che incapsula:
 *  - creazione firma_sessione
 *  - dialog di attesa con countdown
 *  - dialog di finalizzazione (firma medico + salvataggio)
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
}: Props) {
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [waitOpen, setWaitOpen] = useState(false);
  const [signedRow, setSignedRow] = useState<FirmaSessioneRow | null>(null);

  async function handleClick() {
    if (!user) {
      toast.error("Sessione non valida");
      return;
    }
    setCreating(true);
    try {
      const finalSession = buildSession ? await buildSession() : session;
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
    } finally {
      setCreating(false);
    }
  }

  function handleSigned(row: FirmaSessioneRow) {
    setWaitOpen(false);
    setSignedRow(row);
  }

  function reset() {
    setSessionId(null);
    setSignedRow(null);
    setWaitOpen(false);
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => void handleClick()}
        disabled={disabled || creating}
      >
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tablet className="h-4 w-4" />}
        {label}
      </Button>

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
