import { SendToTabletButton } from "@/components/firma/send-to-tablet-button";
import type { SignatureSession } from "@/lib/signature-session";

/**
 * Wrapper "headless" del SendToTabletButton.
 *
 * Va montato a livello del componente che contiene il SignatureSessionDialog
 * (NON dentro al dialog stesso, altrimenti i listener Realtime morirebbero
 * alla chiusura del dialog). Quando `session` diventa non-null, parte in
 * automatico il flusso: creazione sessione tablet, attesa firma, finalizzazione.
 */
export function TabletSessionRunner({
  session,
  pazienteNome,
  onClose,
  onCompleted,
}: {
  session: SignatureSession | null;
  pazienteNome: string;
  /** Chiamato quando il flusso si chiude (annullamento, errore, completamento). */
  onClose: () => void;
  /** Chiamato dopo il salvataggio finale. */
  onCompleted?: () => void;
}) {
  return (
    <SendToTabletButton
      session={null}
      pazienteNome={pazienteNome || "Paziente"}
      controlledSession={session}
      onControlledClose={onClose}
      onCompleted={onCompleted}
    />
  );
}
