import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Search, Package, AlertTriangle, Clock, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  cambiaModalita,
  listLottiPerProdotti,
  listMovimenti,
  listProdotti,
} from "@/lib/magazzino";
import type {
  Lotto,
  ModalitaTracking,
  Movimento,
  ProdottoConDettagli,
} from "@/types/magazzino";
import {
  MODALITA_LABELS,
  MOVIMENTO_LABELS,
  statoLotto,
} from "@/types/magazzino";
import { ProdottoFormDialog } from "@/components/magazzino/prodotto-form-dialog";
import { LottoFormDialog } from "@/components/magazzino/lotto-form-dialog";
import { RettificaDialog } from "@/components/magazzino/rettifica-dialog";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/magazzino/")({
  component: MagazzinoPage,
});

const STATO_BADGE: Record<string, string> = {
  esaurito: "bg-muted text-muted-foreground",
  scaduto: "bg-destructive/15 text-destructive",
  scadenza_vicina: "bg-destructive/15 text-destructive",
  sotto_soglia: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

const MODALITA_BADGE: Record<ModalitaTracking, string> = {
  tracciato: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  solo_uso: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  standby: "bg-muted text-muted-foreground",
};

function MagazzinoPage() {
  const [tab, setTab] = React.useState("prodotti");
  const [prodotti, setProdotti] = React.useState<ProdottoConDettagli[]>([]);
  const [lotti, setLotti] = React.useState<Lotto[]>([]);
  const [movimenti, setMovimenti] = React.useState<Movimento[]>([]);
  const [search, setSearch] = React.useState("");
  const [filtroModalita, setFiltroModalita] = React.useState<string>("__all__");
  const [includiStandby, setIncludiStandby] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [openNuovoProdotto, setOpenNuovoProdotto] = React.useState(false);
  const [openLotto, setOpenLotto] = React.useState(false);
  const [openRettifica, setOpenRettifica] = React.useState(false);
  const [prodottoSel, setProdottoSel] = React.useState<ProdottoConDettagli | null>(null);
  const [lottoSel, setLottoSel] = React.useState<Lotto | null>(null);
  const [modalitaRett, setModalitaRett] = React.useState<"rettifica" | "scarico">("rettifica");
  const [drawerProdotto, setDrawerProdotto] = React.useState<ProdottoConDettagli | null>(null);

  const ricarica = React.useCallback(async () => {
    setLoading(true);
    try {
      const p = await listProdotti({
        search,
        modalita: filtroModalita !== "__all__" ? (filtroModalita as ModalitaTracking) : null,
        includiStandby,
      });
      setProdotti(p);
      const ids = p.map((x) => x.id);
      const l = await listLottiPerProdotti(ids);
      setLotti(l);
      const m = await listMovimenti({ limit: 200 });
      setMovimenti(m);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  }, [search, filtroModalita, includiStandby]);

  React.useEffect(() => {
    void ricarica();
  }, [ricarica]);

  const prodottoMap = React.useMemo(
    () => new Map(prodotti.map((p) => [p.id, p])),
    [prodotti],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Magazzino</h1>
          <p className="text-sm text-muted-foreground">
            Prodotti, lotti, movimenti. Ogni prodotto può essere
            <span className="font-medium"> tracciato</span> (scorte vere),
            <span className="font-medium"> solo uso</span> (registra senza decremento) o
            <span className="font-medium"> standby</span>.
          </p>
        </div>
        <Button onClick={() => { setProdottoSel(null); setOpenNuovoProdotto(true); }}>
          <Plus className="h-4 w-4" /> Nuovo prodotto
        </Button>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="prodotti"><Package className="h-4 w-4" /> Prodotti</TabsTrigger>
          <TabsTrigger value="lotti"><Clock className="h-4 w-4" /> Lotti</TabsTrigger>
          <TabsTrigger value="movimenti"><Settings2 className="h-4 w-4" /> Movimenti</TabsTrigger>
        </TabsList>

        {/* PRODOTTI */}
        <TabsContent value="prodotti" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Cerca prodotto…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filtroModalita} onValueChange={setFiltroModalita}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tutte modalità</SelectItem>
                <SelectItem value="tracciato">Solo tracciati</SelectItem>
                <SelectItem value="solo_uso">Solo uso</SelectItem>
                <SelectItem value="standby">Standby</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIncludiStandby((v) => !v)}
            >
              {includiStandby ? "Nascondi standby" : "Mostra standby"}
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Modalità</TableHead>
                  <TableHead className="text-right">Qta</TableHead>
                  <TableHead className="text-right">Lotti</TableHead>
                  <TableHead>Unità</TableHead>
                  <TableHead className="text-right">Soglia</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Caricamento…</TableCell></TableRow>
                )}
                {!loading && prodotti.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Nessun prodotto. Clicca "Nuovo prodotto" per iniziare.</TableCell></TableRow>
                )}
                {prodotti.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setDrawerProdotto(p)}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]", MODALITA_BADGE[p.modalita_tracking])}>
                        {MODALITA_LABELS[p.modalita_tracking]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.modalita_tracking === "tracciato" ? p.qta_totale ?? 0 : "—"}
                    </TableCell>
                    <TableCell className="text-right">{p.num_lotti ?? 0}</TableCell>
                    <TableCell>{p.unita_misura}</TableCell>
                    <TableCell className="text-right">{p.soglia_minima || "—"}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setProdottoSel(p); setLottoSel(null); setOpenLotto(true); }}
                      >
                        + Lotto
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* LOTTI */}
        <TabsContent value="lotti">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prodotto</TableHead>
                  <TableHead>Lotto</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead className="text-right">Qta</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotti.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Nessun lotto a magazzino.</TableCell></TableRow>
                )}
                {lotti.map((l) => {
                  const p = prodottoMap.get(l.prodotto_id);
                  const stato = statoLotto(l, p?.soglia_minima ?? 0);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{p?.nome ?? "?"}</TableCell>
                      <TableCell className="font-mono text-xs">{l.numero_lotto}</TableCell>
                      <TableCell>{l.data_scadenza ?? "—"}</TableCell>
                      <TableCell className="text-right">{l.quantita_disponibile}</TableCell>
                      <TableCell className="text-right">{l.costo_unitario != null ? `€ ${l.costo_unitario}` : "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px]", STATO_BADGE[stato])}>
                          {stato.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {p?.modalita_tracking === "tracciato" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setLottoSel(l); setModalitaRett("rettifica"); setOpenRettifica(true); }}
                          >
                            Rettifica
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setLottoSel(l); setModalitaRett("scarico"); setOpenRettifica(true); }}
                        >
                          Scarico
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* MOVIMENTI */}
        <TabsContent value="movimenti">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prodotto</TableHead>
                  <TableHead className="text-right">Qta</TableHead>
                  <TableHead>Note / motivazione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimenti.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nessun movimento.</TableCell></TableRow>
                )}
                {movimenti.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{new Date(m.data_movimento).toLocaleString("it-IT")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{MOVIMENTO_LABELS[m.tipo]}</Badge>
                      {m.modalita_snapshot === "solo_uso" && (
                        <span className="ml-1 text-[10px] text-muted-foreground">info</span>
                      )}
                    </TableCell>
                    <TableCell>{prodottoMap.get(m.prodotto_id)?.nome ?? "?"}</TableCell>
                    <TableCell className="text-right">{m.quantita}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.motivazione || m.note || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOGS */}
      <ProdottoFormDialog
        open={openNuovoProdotto}
        onOpenChange={setOpenNuovoProdotto}
        onCreated={() => void ricarica()}
      />
      {prodottoSel && (
        <LottoFormDialog
          open={openLotto}
          onOpenChange={setOpenLotto}
          prodotto={prodottoSel}
          lottoEsistente={lottoSel}
          onSaved={() => void ricarica()}
        />
      )}
      {lottoSel && (
        <RettificaDialog
          open={openRettifica}
          onOpenChange={setOpenRettifica}
          lotto={lottoSel}
          modalita={modalitaRett}
          onSaved={() => void ricarica()}
        />
      )}

      {/* DRAWER PRODOTTO (modal con dettagli) */}
      <Dialog open={!!drawerProdotto} onOpenChange={(o) => !o && setDrawerProdotto(null)}>
        <DialogContent className="max-w-2xl">
          {drawerProdotto && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {drawerProdotto.nome}
                  <Badge variant="outline" className={cn("text-[10px]", MODALITA_BADGE[drawerProdotto.modalita_tracking])}>
                    {MODALITA_LABELS[drawerProdotto.modalita_tracking]}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Cambia modalità:</span>
                  <Select
                    value={drawerProdotto.modalita_tracking}
                    onValueChange={async (v) => {
                      try {
                        await cambiaModalita(drawerProdotto.id, v as ModalitaTracking);
                        toast.success("Modalità aggiornata");
                        setDrawerProdotto(null);
                        void ricarica();
                      } catch (e: unknown) {
                        toast.error(e instanceof Error ? e.message : "Errore");
                      }
                    }}
                  >
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tracciato">Tracciato</SelectItem>
                      <SelectItem value="solo_uso">Solo uso</SelectItem>
                      <SelectItem value="standby">Standby</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium">Lotti</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lotto</TableHead>
                        <TableHead>Scadenza</TableHead>
                        <TableHead className="text-right">Qta</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lotti.filter((l) => l.prodotto_id === drawerProdotto.id).map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-mono text-xs">{l.numero_lotto}</TableCell>
                          <TableCell>{l.data_scadenza ?? "—"}</TableCell>
                          <TableCell className="text-right">{l.quantita_disponibile}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setProdottoSel(drawerProdotto); setLottoSel(l); setOpenLotto(true); }}
                            >
                              Ricarico
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {lotti.filter((l) => l.prodotto_id === drawerProdotto.id).length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground">Nessun lotto</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <Button
                    className="mt-2"
                    size="sm"
                    onClick={() => { setProdottoSel(drawerProdotto); setLottoSel(null); setOpenLotto(true); }}
                  >
                    <Plus className="h-4 w-4" /> Nuovo lotto
                  </Button>
                </div>

                {drawerProdotto.modalita_tracking === "solo_uso" && (
                  <p className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    Modalità "solo uso": registriamo lotti e consumi per tracciabilità medico-legale, ma le scorte non vengono decrementate. Ideale per prodotti condivisi con altri operatori.
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
