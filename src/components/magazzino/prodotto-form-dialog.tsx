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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { creaProdotto, listMarche, creaMarca, listTipologie } from "@/lib/magazzino";
import type { Marca, ModalitaTracking, Prodotto } from "@/types/magazzino";
import { MODALITA_DESCRIZIONI, MODALITA_LABELS } from "@/types/magazzino";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Default "solo_uso" — coerente con la fase beta */
  defaultModalita?: ModalitaTracking;
  onCreated?: (p: Prodotto) => void;
  /** Versione "rapida" mostra meno campi (per uso inline in seduta) */
  rapido?: boolean;
}

const UNITA = ["pz", "ml", "fiala", "siringa", "flacone", "applicazione", "U"];

const TIPOLOGIE_PREDEFINITE = [
  "Filler",
  "Biostimolante",
  "Tossina botulinica",
  "Peeling",
  "Anestetico",
  "Ago / cannula",
  "Materiale di consumo",
  "Skincare",
  "Integratore",
  "Altro",
];

export function ProdottoFormDialog({
  open,
  onOpenChange,
  defaultModalita = "solo_uso",
  onCreated,
  rapido = false,
}: Props) {
  const [nome, setNome] = React.useState("");
  const [marche, setMarche] = React.useState<Marca[]>([]);
  const [marcaId, setMarcaId] = React.useState<string | null>(null);
  const [nuovaMarca, setNuovaMarca] = React.useState("");
  const [tipologia, setTipologia] = React.useState("");
  const [unita, setUnita] = React.useState("pz");
  const [modalita, setModalita] = React.useState<ModalitaTracking>(defaultModalita);
  const [costo, setCosto] = React.useState("");
  const [soglia, setSoglia] = React.useState("0");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [tipologie, setTipologie] = React.useState<string[]>([]);
  const [tipoOpen, setTipoOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setNome("");
      setMarcaId(null);
      setNuovaMarca("");
      setTipologia("");
      setUnita("pz");
      setModalita(defaultModalita);
      setCosto("");
      setSoglia("0");
      setNote("");
      listMarche().then(setMarche).catch(() => setMarche([]));
      listTipologie()
        .then((db) => {
          // Merge predefinite + DB, dedup case-insensitive, ordina
          const map = new Map<string, string>();
          [...TIPOLOGIE_PREDEFINITE, ...db].forEach((t) => {
            const k = t.trim().toLowerCase();
            if (k && !map.has(k)) map.set(k, t.trim());
          });
          setTipologie(Array.from(map.values()).sort((a, b) => a.localeCompare(b)));
        })
        .catch(() => setTipologie(TIPOLOGIE_PREDEFINITE));
    }
  }, [open, defaultModalita]);

  async function salva() {
    if (!nome.trim()) {
      toast.error("Nome obbligatorio");
      return;
    }
    setBusy(true);
    try {
      let mid = marcaId;
      if (nuovaMarca.trim()) {
        const m = await creaMarca(nuovaMarca.trim());
        mid = m.id;
      }
      const p = await creaProdotto({
        nome: nome.trim(),
        marca_id: mid,
        tipologia: tipologia.trim() || null,
        unita_misura: unita,
        modalita_tracking: modalita,
        costo_unitario_default: costo ? Number(costo) : null,
        soglia_minima: soglia ? Number(soglia) : 0,
        note: note.trim() || null,
      });
      toast.success("Prodotto creato");
      onCreated?.(p);
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore creazione prodotto";
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rapido ? "Nuovo prodotto (rapido)" : "Nuovo prodotto"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Profhilo 2ml" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Marca</Label>
              <Select
                value={marcaId ?? ""}
                onValueChange={(v) => {
                  setMarcaId(v || null);
                  setNuovaMarca("");
                }}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {marche.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="mt-1"
                placeholder="…o nuova marca"
                value={nuovaMarca}
                onChange={(e) => {
                  setNuovaMarca(e.target.value);
                  if (e.target.value.trim()) setMarcaId(null);
                }}
              />
            </div>
            <div>
              <Label>Unità misura</Label>
              <Select value={unita} onValueChange={setUnita}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITA.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!rapido && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipologia</Label>
                <Popover open={tipoOpen} onOpenChange={setTipoOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      <span className={cn("truncate", !tipologia && "text-muted-foreground")}>
                        {tipologia || "Seleziona o digita…"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={true}>
                      <CommandInput
                        placeholder="Cerca o aggiungi…"
                        value={tipologia}
                        onValueChange={setTipologia}
                      />
                      <CommandList className="max-h-64 overflow-y-auto">
                        <CommandEmpty>
                          {tipologia.trim() ? (
                            <button
                              type="button"
                              className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent"
                              onClick={() => setTipoOpen(false)}
                            >
                              + Usa "{tipologia.trim()}"
                            </button>
                          ) : (
                            <span className="block px-2 py-1.5 text-sm text-muted-foreground">
                              Nessuna tipologia
                            </span>
                          )}
                        </CommandEmpty>
                        <CommandGroup>
                          {tipologie.map((t) => (
                            <CommandItem
                              key={t}
                              value={t}
                              onSelect={() => {
                                setTipologia(t);
                                setTipoOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  tipologia === t ? "opacity-100" : "opacity-0",
                                )}
                              />
                              {t}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Costo unitario (€)</Label>
                <Input type="number" step="0.01" value={costo} onChange={(e) => setCosto(e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <Label>Modalità tracking</Label>
            <Select value={modalita} onValueChange={(v) => setModalita(v as ModalitaTracking)}>
              <SelectTrigger>
                <SelectValue>
                  {MODALITA_LABELS[modalita]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MODALITA_LABELS) as ModalitaTracking[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    <div>
                      <div className="font-medium">{MODALITA_LABELS[m]}</div>
                      <div className="text-xs text-muted-foreground">{MODALITA_DESCRIZIONI[m]}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!rapido && (
            <>
              <div>
                <Label>Soglia minima alert</Label>
                <Input type="number" step="0.01" value={soglia} onChange={(e) => setSoglia(e.target.value)} />
              </div>
              <div>
                <Label>Note</Label>
                <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annulla</Button>
          <Button onClick={salva} disabled={busy}>Crea prodotto</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
