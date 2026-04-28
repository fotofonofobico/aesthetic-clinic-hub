import * as React from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
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
    try {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow) throw new Error("Anteprima non pronta");
      frameWindow.focus();
      frameWindow.print();
    } catch {
      toast.error("Se la stampa non parte, usa Scarica PDF e stampa dal visualizzatore del dispositivo.");
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
            <Button type="button" variant="outline" size="sm" onClick={printPdf} disabled={!url}>
              <Printer className="h-4 w-4" />
              Stampa
            </Button>
            <Button asChild type="button" variant="outline" size="sm" disabled={!url}>
              <a href={url ?? "#"} download={filename}>
                <Download className="h-4 w-4" />
                Scarica PDF
              </a>
            </Button>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-muted">
          {url ? (
            <iframe ref={iframeRef} title={title} src={url} className="h-full w-full border-0 bg-background" />
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