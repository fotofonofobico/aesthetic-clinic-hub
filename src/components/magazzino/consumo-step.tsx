import * as React from "react";
import { logger } from "@/lib/logger";
import { Plus, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProdottoSelectInline } from "./prodotto-select-inline";
import { ProdottoFormDialog } from "./prodotto-form-dialog";
import { listLotti, listProdotti } from "@/lib/magazzino";
import { supabase } from "@/integrations/supabase/client";
import type { Lotto, ProdottoConDettagli, RigaConsumo } from "@/types/magazzino";
import type { KitConsumoDefaultRiga } from "@/types/trattamenti";

export interface ConsumoRiga extends RigaConsumo {
  _key: string;
  _prodotto?: ProdottoConDettagli | null;
  _lotti?: Lotto[];
  _useNuovoLotto?: boolean;
}

interface Props {
  righe: ConsumoRiga[];
  onChange: (righe: ConsumoRiga[]) => void;
  /** Se valorizzato, al primo mount precompila le righe con il kit consumo default del trattamento. */
  trattamentoId?: string | null;
}

function newKey() {
  return Math.random().toString(36).slice(2);
}

export function ConsumoMagazzinoStep({ righe, onChange, trattamentoId }: Props) {
  const [prodotti, setProdotti] = React.useState<ProdottoConDettagli[]>([]);
  const [loadingProdotti, setLoadingProdotti] = React.useState(false);
  const [creaProdottoOpen, setCreaProdottoOpen] = React.useState(false);
  const [creaIdx, setCreaIdx] = React.useState<number | null>(null);

  const refreshProdotti = React.useCallback(async () => {
    setLoadingProdotti(true);
    try {
      const d = await listProdotti({ includiStandby: false });
      setProdotti(d);
    } catch (e) {
      // non fatale: la lista resta vuota, l'utente può comunque creare prodotti
      logger.warn("listProdotti failed", e);
    } finally {
      setLoadingProdotti(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshProdotti();
  }, [refreshProdotti]);

  function addRiga() {
    onChange([
      ...righe,
      { _key: newKey(), prodotto_id: "", quantita: 1, lotto_id: null },
    ]);
  }

  function updateRiga(idx: number, patch: Partial<ConsumoRiga>) {
    onChange(righe.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRiga(idx: number) {
    onChange(righe.filter((_, i) => i !== idx));
  }

  async function onProdottoSelect(
    idx: number,
    id: string | null,
    p: ProdottoConDettagli | null,
  ) {
    let lotti: Lotto[] = [];
    if (id && p?.modalita_tracking === "tracciato") {
      try {
        lotti = await listLotti({ prodotto_id: id });
      } catch (e) {
        logger.warn("listLotti failed", e);
        toast.error("Impossibile caricare i lotti del prodotto");
        lotti = [];
      }
    } else if (id && p?.modalita_tracking === "solo_uso") {
      // Anche per solo_uso recuperiamo lotti già registrati per riutilizzarli
      try {
        lotti = await listLotti({ prodotto_id: id, includiEsauriti: true });
      } catch {
        lotti = [];
      }
    }
    updateRiga(idx, {
      prodotto_id: id ?? "",
      _prodotto: p,
      _lotti: lotti,
      lotto_id: null,
      _useNuovoLotto: false,
      nuovo_lotto: null,
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold">Consumo magazzino</Label>
          <Badge variant="outline" className="text-[10px]">
            opzionale
          </Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRiga}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Riga
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        FEFO automatico per prodotti tracciati. Per "solo uso" registra solo
        l'utilizzo (no scarico). Lo scarico avviene al completamento.
      </p>

      {righe.length === 0 && (
        <p className="rounded-md border border-dashed border-border/60 bg-background/40 p-3 text-center text-xs text-muted-foreground">
          Nessuna riga di consumo. Aggiungi se vuoi tracciare lotti/quantità.
        </p>
      )}

      {righe.map((r, idx) => {
        const tracciato = r._prodotto?.modalita_tracking === "tracciato";
        const soloUso = r._prodotto?.modalita_tracking === "solo_uso";
        const lotti = Array.isArray(r._lotti) ? r._lotti : [];
        return (
          <div
            key={r._key}
            className="space-y-2 rounded-md border border-border/60 bg-background p-2"
          >
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="text-[11px]">Prodotto</Label>
                <ProdottoSelectInline
                  prodotti={prodotti}
                  loading={loadingProdotti}
                  value={r.prodotto_id || null}
                  onChange={(id, p) => void onProdottoSelect(idx, id, p)}
                  onCreaNuovo={() => {
                    setCreaIdx(idx);
                    setCreaProdottoOpen(true);
                  }}
                />
              </div>
              <div className="w-20">
                <Label className="text-[11px]">Q.tà</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={r.quantita}
                  onChange={(e) =>
                    updateRiga(idx, { quantita: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRiga(idx)}
                className="h-9 w-9 text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {(tracciato || soloUso) && (
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label className="text-[11px]">
                    {tracciato ? "Lotto (FEFO se vuoto)" : "Lotto / scadenza (opzionale)"}
                  </Label>
                  <Select
                    value={r._useNuovoLotto ? "__new__" : r.lotto_id ?? "__auto__"}
                    onValueChange={(v) => {
                      if (v === "__new__") {
                        updateRiga(idx, {
                          _useNuovoLotto: true,
                          lotto_id: null,
                          nuovo_lotto: { numero_lotto: "", data_scadenza: null, costo: null },
                        });
                      } else if (v === "__auto__") {
                        updateRiga(idx, {
                          _useNuovoLotto: false,
                          lotto_id: null,
                          nuovo_lotto: null,
                        });
                      } else {
                        updateRiga(idx, {
                          _useNuovoLotto: false,
                          lotto_id: v,
                          nuovo_lotto: null,
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__auto__">
                        {tracciato ? "Auto FEFO" : "Senza lotto"}
                      </SelectItem>
                      {lotti
                        .filter((l) => tracciato ? l.quantita_disponibile > 0 : true)
                        .map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.numero_lotto}
                            {tracciato ? ` · ${l.quantita_disponibile} disp.` : ""}
                            {l.data_scadenza ? ` · scad ${l.data_scadenza}` : ""}
                          </SelectItem>
                        ))}
                      <SelectItem value="__new__">+ Nuovo lotto inline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {r._useNuovoLotto && (
              <div className="grid gap-2 rounded-md bg-muted/40 p-2 md:grid-cols-3">
                <div>
                  <Label className="text-[11px]">N. lotto *</Label>
                  <Input
                    value={r.nuovo_lotto?.numero_lotto ?? ""}
                    onChange={(e) =>
                      updateRiga(idx, {
                        nuovo_lotto: {
                          ...(r.nuovo_lotto ?? { numero_lotto: "" }),
                          numero_lotto: e.target.value,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Scadenza</Label>
                  <Input
                    type="date"
                    value={r.nuovo_lotto?.data_scadenza ?? ""}
                    onChange={(e) =>
                      updateRiga(idx, {
                        nuovo_lotto: {
                          ...(r.nuovo_lotto ?? { numero_lotto: "" }),
                          data_scadenza: e.target.value || null,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-[11px]">Costo unit.</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={r.nuovo_lotto?.costo ?? ""}
                    onChange={(e) =>
                      updateRiga(idx, {
                        nuovo_lotto: {
                          ...(r.nuovo_lotto ?? { numero_lotto: "" }),
                          costo: e.target.value ? Number(e.target.value) : null,
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <ProdottoFormDialog
        open={creaProdottoOpen}
        onOpenChange={(o) => {
          setCreaProdottoOpen(o);
          if (!o) setCreaIdx(null);
        }}
        rapido
        onCreated={(p) => {
          // ricarica la lista così il nuovo prodotto compare ovunque
          void refreshProdotti().then(() => {
            if (creaIdx != null) {
              void onProdottoSelect(creaIdx, p.id, p as ProdottoConDettagli);
            }
          });
          setCreaProdottoOpen(false);
          setCreaIdx(null);
        }}
      />
    </div>
  );
}

export function righeToRigheConsumo(righe: ConsumoRiga[]): RigaConsumo[] {
  return righe
    .filter((r) => r.prodotto_id && r.quantita > 0)
    .map((r) => ({
      prodotto_id: r.prodotto_id,
      lotto_id: r._useNuovoLotto ? null : r.lotto_id ?? null,
      quantita: r.quantita,
      nuovo_lotto:
        r._useNuovoLotto && r.nuovo_lotto?.numero_lotto ? r.nuovo_lotto : null,
    }));
}
