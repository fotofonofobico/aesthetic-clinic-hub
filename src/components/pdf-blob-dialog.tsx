import * as React from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PdfCanvasViewer } from "@/components/pdf-canvas-viewer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PdfBlobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blob: Blob | null;
  title: string;
  filename: string;
}

export function PdfBlobDialog({ open, onOpenChange, blob, title, filename }: PdfBlobDialogProps) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !blob) {
      setUrl(null);
      return;
    }

    const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
    const nextUrl = URL.createObjectURL(pdfBlob);
    setUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [blob, open]);

  function downloadPdf() {
    if (!blob) return;
    try {
      const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
      const dlUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = dlUrl;
      link.download = filename;
      link.rel = "noopener noreferrer";
      // su iOS Safari il download può non partire: in tal caso apriamo in nuovo tab
      const ua = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
      if (isIOS) {
        window.open(dlUrl, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(dlUrl), 30_000);
        return;
      }
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(dlUrl), 5_000);
    } catch (err) {
      console.error("[pdf-blob-dialog] download failed", err);
      toast.error("Impossibile scaricare il PDF. Riprova o usa Stampa.");
    }
  }

  function printPdf() {
    if (!blob) return;
    try {
      const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
      const printUrl = URL.createObjectURL(pdfBlob);
      const w = window.open(printUrl, "_blank", "noopener,noreferrer");
      if (!w) {
        toast.error("Popup bloccato. Abilita i popup o usa Scarica PDF.");
        URL.revokeObjectURL(printUrl);
        return;
      }
      setTimeout(() => URL.revokeObjectURL(printUrl), 60_000);
    } catch (err) {
      console.error("[pdf-blob-dialog] print failed", err);
      toast.error("Se la stampa non parte, usa Scarica PDF.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-[min(96vw,1100px)] grid-rows-[auto_1fr] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base">{title}</DialogTitle>
              <DialogDescription>Anteprima PDF interna, senza popup o schede fittizie.</DialogDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={printPdf} disabled={!blob}>
              <Printer className="h-4 w-4" />
              Stampa
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={downloadPdf} disabled={!blob}>
              <Download className="h-4 w-4" />
              Scarica PDF
            </Button>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-muted">
          {url ? (
            <PdfCanvasViewer blob={blob} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Generazione anteprima…
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}