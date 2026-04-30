import * as React from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfCanvasViewerProps {
  blob: Blob | null;
  className?: string;
  onError?: (message: string) => void;
  onReadyChange?: (ready: boolean) => void;
}

export function PdfCanvasViewer({ blob, className, onError, onReadyChange }: PdfCanvasViewerProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const printHostRef = React.useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const updateWidth = () => setWidth(host.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const printHost = document.createElement("div");
    printHost.setAttribute("data-pdf-print-pages", "true");
    document.body.appendChild(printHost);
    printHostRef.current = printHost;

    return () => {
      printHost.remove();
      if (printHostRef.current === printHost) printHostRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const host = hostRef.current;
    const printHost = printHostRef.current;
    if (!host || !blob || width <= 0 || !printHost) return;
    const currentHost = host;
    const currentPrintHost = printHost;
    const pdfBlob = blob;

    let cancelled = false;
    currentHost.innerHTML = "";
    currentPrintHost.innerHTML = "";
    setLoading(true);
    setError(null);
    onReadyChange?.(false);

    async function render() {
      try {
        const data = await pdfBlob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data, useWorkerFetch: false } as Parameters<
          typeof pdfjsLib.getDocument
        >[0]).promise;
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const cssWidth = Math.max(280, width - 32);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(cssWidth / baseViewport.width, 2);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas PDF non disponibile");

          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          canvas.className = "mx-auto my-4 block rounded-md bg-background shadow-sm";
          context.setTransform(dpr, 0, 0, dpr, 0, 0);

          await page.render({ canvas, canvasContext: context, viewport, intent: "display" })
            .promise;
          if (!cancelled) currentHost.appendChild(canvas);

          const printViewport = page.getViewport({ scale: 2 });
          const printCanvas = document.createElement("canvas");
          const printContext = printCanvas.getContext("2d");
          if (!printContext) throw new Error("Canvas PDF non disponibile");
          printCanvas.width = Math.floor(printViewport.width);
          printCanvas.height = Math.floor(printViewport.height);
          printCanvas.style.width = `${(baseViewport.width * 25.4) / 72}mm`;
          printCanvas.style.height = `${(baseViewport.height * 25.4) / 72}mm`;

          await page.render({
            canvas: printCanvas,
            canvasContext: printContext,
            viewport: printViewport,
            intent: "print",
          }).promise;
          if (!cancelled) currentPrintHost.appendChild(printCanvas);
        }
        await pdf.destroy();
        if (!cancelled) onReadyChange?.(true);
      } catch (e) {
        if (cancelled) return;
        const message = (e as Error).message || "Anteprima PDF non riuscita";
        console.error("[pdf preview]", e);
        setError(
          "Anteprima PDF non riuscita su questo browser. Usa il pulsante Stampa per aprirlo nativamente.",
        );
        onReadyChange?.(false);
        onError?.(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void render();

    return () => {
      cancelled = true;
      currentHost.innerHTML = "";
      currentPrintHost.innerHTML = "";
      onReadyChange?.(false);
    };
  }, [blob, onError, onReadyChange, width]);

  return (
    <div className={cn("relative h-full overflow-auto bg-muted", className)}>
      <div ref={hostRef} className="min-h-full px-4 py-2" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-muted/80 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Caricamento PDF…
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center">
          <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        </div>
      )}
    </div>
  );
}
