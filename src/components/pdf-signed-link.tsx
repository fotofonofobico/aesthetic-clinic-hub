import * as React from "react";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  bucket: string;
  path: string;
  label?: string;
}

/**
 * Link riusabile a un PDF privato in Supabase Storage tramite signed URL.
 * Verifica che il file esista (HEAD) prima di mostrare il link cliccabile,
 * altrimenti rende un fallback "PDF non disponibile" (no link morto).
 */
export function PdfSignedLink({ bucket, path, label = "Apri PDF firmato" }: Props) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [state, setState] = React.useState<"loading" | "ok" | "missing" | "error">("loading");
  const [errMsg, setErrMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      setState("loading");
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 10);
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        setErrMsg(error?.message ?? "Impossibile generare il link");
        setState("error");
        return;
      }
      // HEAD per verificare che il file esista realmente
      try {
        const head = await fetch(data.signedUrl, { method: "HEAD" });
        if (cancelled) return;
        if (!head.ok) {
          setState("missing");
          return;
        }
        setUrl(data.signedUrl);
        setState("ok");
      } catch {
        if (cancelled) return;
        // Se la HEAD fallisce per CORS/network, mostriamo comunque il link
        // (il browser lo aprirà direttamente; meglio un tentativo che un falso "missing")
        setUrl(data.signedUrl);
        setState("ok");
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  if (state === "loading") {
    return <p className="text-xs text-muted-foreground">Caricamento PDF…</p>;
  }
  if (state === "missing") {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        PDF non disponibile (file mancante nello storage)
      </p>
    );
  }
  if (state === "error" || !url) {
    return <p className="text-xs text-destructive">Errore link PDF: {errMsg}</p>;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
    >
      <FileText className="h-4 w-4" />
      {label}
    </a>
  );
}
