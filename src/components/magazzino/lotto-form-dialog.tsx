import * as React from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { creaLotto, aggiungiCarico } from "@/lib/magazzino";
import type { Lotto, Prodotto } from "@/types/magazzino";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prodotto: Prodotto;
  /** Se valorizzato, è un ricarico su lotto esistente */
  lottoEsistente?: Lotto | null;
  onSaved?: () => void;
}

export function LottoFormDialog({ open, onOpenChange, prodotto, lottoEsistente, onSaved }: Props) {
  const [numeroLotto, setNumeroLotto] = React.useState("");
  const [scadenza, setScadenza] = React.useState("");
  const [quantita, setQuantita] = React.useState("");
  const [costo, setCosto] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const ricarico = !!lottoEsistente;

  React.useEffect(() => {
    if (open) {
      setNumeroLotto(lottoEsistente?.numero_lotto ?? "");
      setScadenza(lottoEsistente?.data_scadenza ?? "");
      setQuantita("");
      setCosto(
        lottoEsistente?.costo_unitario?.toString() ??
          prodotto.costo_unitario_default?.toString() ??
          "",
      );
      setNote("");
    }
  }, [open, lottoEsistente, prodotto]);

  async function salva() {
    const qta = Number(quantita);
    if (!qta || qta <= 0) {
      toast.error("Quantità non valida");
      return;
    }
    setBusy(true);
    try {
      if (ricarico && lottoEsistente) {
        await aggiungiCarico(lottoEsistente.id, prodotto.id, qta, costo ? Number(costo) : null);
        toast.success("Ricarico registrato");
      } else {
        if (!numeroLotto.trim()) {
          toast.error("Numero lotto obbligatorio");
          setBusy(false);
          return;
        }
        await creaLotto({
          prodotto_id: prodotto.id,
          numero_lotto: numeroLotto.trim(),
          data_scadenza: scadenza || null,
          quantita: qta,
          costo_unitario: costo ? Number(costo) : null,
          note: note.trim() || null,
        });
        toast.success("Lotto creato");
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
            {ricarico ? `Ricarico lotto ${lottoEsistente?.numero_lotto}` : "Nuovo lotto"} — {prodotto.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {!ricarico && (
            <>
              <div>
                <Label>Numero lotto *</Label>
                <Input value={numeroLotto} onChange={(e) => setNumeroLotto(e.target.value)} />
              </div>
              <div>
                <Label>Data scadenza</Label>
                <Input type="date" value={scadenza} onChange={(e) => setScadenza(e.target.value)} />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantità *</Label>
              <Input type="number" step="0.01" value={quantita} onChange={(e) => setQuantita(e.target.value)} />
            </div>
            <div>
              <Label>Costo unitario (€)</Label>
              <Input type="number" step="0.01" value={costo} onChange={(e) => setCosto(e.target.value)} />
            </div>
          </div>
          {!ricarico && (
            <div>
              <Label>Note</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
          <Button onClick={salva} disabled={busy}>{ricarico ? "Registra carico" : "Crea lotto"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
