import * as React from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfCanvasViewer } from "@/components/pdf-canvas-viewer";
import { printBlob } from "@/lib/download";
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
  /** Mantenuto per compatibilità — non usato (download rimosso). */
  filename?: string;
}

export function PdfBlobDialog({ open, onOpenChange, blob, title }: PdfBlobDialogProps) {
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

  function printPdf() {
    if (!blob) return;
    printBlob(blob, "application/pdf");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-[min(96vw,1100px)] grid-rows-[auto_1fr] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base">{title}</DialogTitle>
              <DialogDescription>Anteprima PDF interna. Usa Stampa per stampare o salvare.</DialogDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={printPdf} disabled={!blob}>
              <Printer className="h-4 w-4" />
              Stampa
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
