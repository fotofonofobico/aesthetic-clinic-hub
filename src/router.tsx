import { createRouter, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { routeTree } from "./routeTree.gen";

const CHUNK_RELOAD_KEY = "__chunk_reload_attempt__";

function isChunkLoadError(err: Error): boolean {
  const msg = (err?.message || "").toLowerCase();
  const name = (err?.name || "").toLowerCase();
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("unable to preload css") ||
    name === "chunkloaderror"
  );
}

/** Errori transitori che non devono mostrare la UI di errore. */
function isTransientError(err: Error): boolean {
  const msg = (err?.message || "").toLowerCase();
  const name = (err?.name || "").toLowerCase();
  return (
    name === "aborterror" ||
    name === "cancellederror" ||
    msg.includes("aborted") ||
    msg.includes("cancelled") ||
    msg.includes("the user aborted")
  );
}

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  // Mostra la UI solo dopo un breve delay: se l'errore è transitorio
  // (race tra navigazioni / Suspense) il componente viene smontato prima
  // e l'utente non vede il flash rosso.
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Chunk-load errors → reload silenzioso
    if (isChunkLoadError(error)) {
      const already = sessionStorage.getItem(CHUNK_RELOAD_KEY);
      if (!already) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
      return;
    }
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);

    // Errori innocui (abort/cancel): non mostriamo nulla, tentiamo reset.
    if (isTransientError(error)) {
      reset();
      return;
    }

    // Errori reali: mostra dopo 300ms per evitare flash su navigazioni rapide.
    const t = window.setTimeout(() => setShow(true), 300);
    return () => window.clearTimeout(t);
  }, [error, reset]);

  if (!show) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Qualcosa è andato storto</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Si è verificato un errore. Riprova oppure torna alla home.
        </p>
        {import.meta.env.DEV && error.message && (
          <pre className="mt-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Riprova
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Vai alla home
          </a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
