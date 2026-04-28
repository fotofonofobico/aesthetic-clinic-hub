import * as React from "react";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { renderPdfInWindow } from "@/lib/pdf-viewer";

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
  const busyRef = React.useRef(false);

  async function handleClick() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const pdfWindow = window.open("", "_blank");
    if (!pdfWindow) {
      busyRef.current = false;
      setBusy(false);
      toast.error("Abilita i popup per aprire il PDF.");
      return;
    }
    pdfWindow.opener = null;
    pdfWindow.document.write(
      '<!doctype html><html lang="it"><head><title>Caricamento PDF…</title></head><body style="font-family:system-ui,sans-serif;padding:24px;color:#111">Caricamento PDF…</body></html>',
    );
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
        pdfWindow.close();
        onMissing?.();
        return;
      }
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error || !data) {
        toast.error(`PDF presente ma non scaricabile: ${error?.message ?? "n/d"}`);
        pdfWindow.close();
        return;
      }
      await renderPdfInWindow(pdfWindow, data, label);
    } finally {
      busyRef.current = false;
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
