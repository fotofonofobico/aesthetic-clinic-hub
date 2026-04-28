import * as React from "react";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  bucket: string;
  path: string;
  label?: string;
  /** Callback opzionale: invocato se al click rileviamo che il file non esiste in storage. */
  onMissing?: () => void;
}

/**
 * Pulsante che apre un PDF privato in Supabase Storage tramite signed URL
 * generato AL CLICK (no scadenze premature).
 *
 * Verifica esistenza del file via storage.list (API autenticata, niente CORS),
 * non con HEAD sul signed URL (inaffidabile dietro Cloudflare).
 */
export function PdfSignedLink({ bucket, path, label = "Apri PDF firmato", onMissing }: Props) {
  const [busy, setBusy] = React.useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      // Verifica esistenza via list (autenticata, no CORS)
      const lastSlash = path.lastIndexOf("/");
      const folder = lastSlash >= 0 ? path.slice(0, lastSlash) : "";
      const filename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
      const { data: listed, error: listErr } = await supabase.storage
        .from(bucket)
        .list(folder, { search: filename, limit: 1 });
      if (listErr) {
        toast.error(`Errore verifica PDF: ${listErr.message}`);
        return;
      }
      const exists = (listed ?? []).some((o) => o.name === filename);
      if (!exists) {
        toast.error("Il PDF non è più presente nello storage.");
        onMissing?.();
        return;
      }
      // Signed URL fresco (TTL 10 min) generato al click → mai scaduto prima dell'apertura
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 10);
      if (error || !data?.signedUrl) {
        toast.error(`Impossibile generare il link: ${error?.message ?? "n/d"}`);
        return;
      }
      const win = window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      if (!win) {
        // Popup bloccato: fallback con anchor temporaneo
        const a = document.createElement("a");
        a.href = data.signedUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="mt-1 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      {label}
    </button>
  );
}
