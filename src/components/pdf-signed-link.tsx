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
 * Estratto da consensi-panel per condividerlo con anamnesi-panel.
 */
export function PdfSignedLink({ bucket, path, label = "Apri PDF firmato" }: Props) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 10)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setError(error?.message ?? "Impossibile generare il link");
          return;
        }
        setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, path]);
  if (error)
    return <p className="text-xs text-destructive">Errore link PDF: {error}</p>;
  if (!url) return <p className="text-xs text-muted-foreground">Caricamento PDF…</p>;
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
