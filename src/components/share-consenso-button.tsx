import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Share2, Copy, Check, Loader2 } from "lucide-react";
import { createShareLink } from "@/lib/share-link";

interface Props {
  consensoId: string;
}

export function ShareConsensoButton({ consensoId }: Props) {
  const [open, setOpen] = useState(false);
  const [ttl, setTtl] = useState(72);
  const [creating, setCreating] = useState(false);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function genera() {
    setCreating(true);
    try {
      const r = await createShareLink({ consensoId, ttlHours: ttl });
      setLink({ url: r.url, expiresAt: r.expiresAt });
    } catch (e) {
      toast.error(`Errore: ${(e as Error).message}`);
    } finally {
      setCreating(false);
    }
  }

  async function copia() {
    if (!link) return;
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
    toast.success("Link copiato");
    setTimeout(() => setCopied(false), 2000);
  }

  function chiudi(v: boolean) {
    setOpen(v);
    if (!v) {
      setLink(null);
      setTtl(72);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
        Condividi col paziente
      </Button>

      <Dialog open={open} onOpenChange={chiudi}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Link sicuro per il paziente</DialogTitle>
          </DialogHeader>

          {!link ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Genera un link temporaneo che il paziente può aprire per visualizzare
                e scaricare il proprio consenso firmato.
              </p>
              <div>
                <Label>Validità (ore)</Label>
                <Input
                  type="number"
                  min={1}
                  max={720}
                  value={ttl}
                  onChange={(e) => setTtl(Math.max(1, Number(e.target.value) || 72))}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Link</Label>
                <div className="flex gap-2">
                  <Input value={link.url} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => void copia()}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Scade il {new Date(link.expiresAt).toLocaleString("it-IT")}.
              </p>
            </div>
          )}

          <DialogFooter>
            {!link ? (
              <>
                <Button variant="ghost" onClick={() => chiudi(false)}>
                  Annulla
                </Button>
                <Button onClick={() => void genera()} disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generazione…
                    </>
                  ) : (
                    "Genera link"
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={() => chiudi(false)}>Chiudi</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
