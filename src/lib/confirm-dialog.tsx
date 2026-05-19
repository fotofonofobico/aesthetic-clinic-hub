import { useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Sostituto di `window.confirm` basato su AlertDialog Radix.
// API imperativa: `await confirmDialog({ title, description })` → boolean.
// Stessa semantica del confirm nativo (true=conferma, false=annulla),
// così possiamo rimpiazzare le chiamate in modo meccanico.
//
// Implementazione: monta un root React isolato sul body per ogni chiamata
// e lo smonta dopo la risposta. Nessuna dipendenza da Provider applicativi
// (utile dato che alcune chiamate stanno dentro mutation handlers senza
// accesso a un context Confirm condiviso).

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  if (typeof document === "undefined") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let root: Root | null = createRoot(host);

    const cleanup = () => {
      // Defer cleanup per permettere all'animazione di chiudersi.
      setTimeout(() => {
        try {
          root?.unmount();
        } catch {
          /* noop */
        }
        root = null;
        if (host.parentNode) host.parentNode.removeChild(host);
      }, 200);
    };

    const handleAnswer = (value: boolean) => {
      resolve(value);
      // Re-render con open=false per far partire l'animazione di chiusura.
      root?.render(<ConfirmShell opts={opts} open={false} onAnswer={() => {}} />);
      cleanup();
    };

    root.render(<ConfirmShell opts={opts} open onAnswer={handleAnswer} />);
  });
}

function ConfirmShell({
  opts,
  open,
  onAnswer,
}: {
  opts: ConfirmOptions;
  open: boolean;
  onAnswer: (v: boolean) => void;
}) {
  // Stato locale per non perdere reattività se React batcha il re-render.
  const [isOpen, setIsOpen] = useState(open);
  useEffect(() => setIsOpen(open), [open]);

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) {
          setIsOpen(false);
          onAnswer(false);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opts.title}</AlertDialogTitle>
          {opts.description && (
            <AlertDialogDescription>{opts.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onAnswer(false)}>
            {opts.cancelLabel ?? "Annulla"}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              opts.destructive &&
                buttonVariants({ variant: "destructive" }),
            )}
            onClick={() => onAnswer(true)}
          >
            {opts.confirmLabel ?? "Conferma"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
