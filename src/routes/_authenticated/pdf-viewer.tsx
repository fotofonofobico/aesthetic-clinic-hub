import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Printer, RefreshCw } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PdfCanvasViewer } from "@/components/pdf-canvas-viewer";

const pdfSearchSchema = z.object({
  bucket: z.enum(["anamnesi-pdf", "consensi-pdf"]),
  path: z.string().min(1),
  title: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/pdf-viewer")({
  validateSearch: pdfSearchSchema,
  component: PdfViewerPage,
});

function PdfViewerPage() {
  const { bucket, path, title } = Route.useSearch();
  const [blob, setBlob] = React.useState<Blob | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [printReady, setPrintReady] = React.useState(false);
  const displayTitle = title || "Documento PDF";

  React.useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      setError(null);
      setBlob(null);
      setPrintReady(false);
      const { data, error: downloadError } = await supabase.storage.from(bucket).download(path);
      if (cancelled) return;
      if (downloadError || !data) {
        setError(downloadError?.message ?? "PDF non scaricabile");
        setLoading(false);
        return;
      }
      const pdfBlob =
        data.type === "application/pdf" ? data : new Blob([data], { type: "application/pdf" });
      setBlob(pdfBlob);
      setLoading(false);
    }

    void loadPdf();

    return () => {
      cancelled = true;
    };
  }, [bucket, path]);

  function printPdf() {
    if (!blob || !printReady) {
      toast.error("PDF non ancora pronto");
      return;
    }
    window.print();
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[620px] flex-col overflow-hidden rounded-lg border border-border bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
          Indietro
        </Button>
        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate text-sm font-semibold text-foreground">{displayTitle}</h1>
          <p className="truncate text-xs text-muted-foreground">Anteprima PDF interna</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={printPdf}
          disabled={!blob || !printReady}
        >
          <Printer className="h-4 w-4" />
          Stampa
        </Button>
      </header>

      <main className="min-h-0 flex-1 bg-muted">
        {loading && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Caricamento PDF…
          </div>
        )}
        {!loading && error && (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <div className="max-w-md space-y-3">
              <h2 className="font-display text-xl font-semibold text-foreground">
                PDF non disponibile
              </h2>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}
        {!loading && !error && blob && (
          <PdfCanvasViewer blob={blob} onReadyChange={setPrintReady} />
        )}
      </main>
    </div>
  );
}
