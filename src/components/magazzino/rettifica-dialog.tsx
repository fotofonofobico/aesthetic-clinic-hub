import * as React from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rettificaInventario, registraScaricoManuale } from "@/lib/magazzino";
import type { Lotto } from "@/types/magazzino";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lotto: Lotto;
  modalita: "rettifica" | "scarico";
  onSaved?: () => void;
}

export function RettificaDialog({ open, onOpenChange, lotto, modalita, onSaved }: Props) {
  const [qtaReale, setQtaReale] = React.useState("");
  const [qtaScarico, setQtaScarico] = React.useState("");
  const [tipoScarico, setTipoScarico] = React.useState<"scarico" | "scarto_scadenza">("scarico");
  const [motivazione, setMotivazione] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setQtaReale(String(lotto.quantita_disponibile));
      setQtaScarico("");
      setTipoScarico("scarico");
      setMotivazione("");
    }
  }, [open, lotto]);

  async function salva() {
    if (motivazione.trim().length < 10) {
      toast.error("Motivazione obbligatoria (min 10 caratteri)");
      return;
    }
    setBusy(true);
    try {
      if (modalita === "rettifica") {
        const reale = Number(qtaReale);
        if (Number.isNaN(reale) || reale < 0) {
          toast.error("Quantità reale non valida");
          setBusy(false);
          return;
        }
        await rettificaInventario({
          lotto_id: lotto.id,
          prodotto_id: lotto.prodotto_id,
          quantita_attuale: lotto.quantita_disponibile,
          quantita_reale: reale,
          motivazione: motivazione.trim(),
        });
        toast.success("Inventario rettificato");
      } else {
        const qta = Number(qtaScarico);
        if (!qta || qta <= 0) {
          toast.error("Quantità non valida");
          setBusy(false);
          return;
        }
        await registraScaricoManuale({
          lotto_id: lotto.id,
          prodotto_id: lotto.prodotto_id,
          quantita: qta,
          tipo: tipoScarico,
          motivazione: motivazione.trim(),
        });
        toast.success("Scarico registrato");
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore";
      if (/row-level security|Sessione scaduta/i.test(msg)) {
        toast.error("Sessione scaduta. Ricarica la pagina e rifai il login.");
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {modalita === "rettifica" ? "Rettifica inventario" : "Scarico manuale"} — lotto {lotto.numero_lotto}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="text-sm text-muted-foreground">
            Quantità attualmente registrata: <span className="font-medium text-foreground">{lotto.quantita_disponibile}</span>
          </div>

          {modalita === "rettifica" ? (
            <div>
              <Label>Quantità reale rilevata *</Label>
              <Input type="number" step="0.01" value={qtaReale} onChange={(e) => setQtaReale(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">
                Verrà creato un movimento di rettifica per la differenza.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantità *</Label>
                  <Input type="number" step="0.01" value={qtaScarico} onChange={(e) => setQtaScarico(e.target.value)} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={tipoScarico} onValueChange={(v) => setTipoScarico(v as "scarico" | "scarto_scadenza")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scarico">Spreco / consumo</SelectItem>
                      <SelectItem value="scarto_scadenza">Scarto per scadenza</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div>
            <Label>Motivazione * (min 10 caratteri)</Label>
            <Textarea rows={3} value={motivazione} onChange={(e) => setMotivazione(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
          <Button onClick={salva} disabled={busy}>Conferma</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
