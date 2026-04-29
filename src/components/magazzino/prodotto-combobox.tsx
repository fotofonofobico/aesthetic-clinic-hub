import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { listProdotti } from "@/lib/magazzino";
import type { ProdottoConDettagli, ModalitaTracking } from "@/types/magazzino";
import { MODALITA_LABELS } from "@/types/magazzino";

interface Props {
  value: string | null;
  onChange: (prodottoId: string | null, prodotto: ProdottoConDettagli | null) => void;
  onCreaNuovo?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

const MODALITA_BADGE: Record<ModalitaTracking, string> = {
  tracciato: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  solo_uso: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  standby: "bg-muted text-muted-foreground",
};

export function ProdottoCombobox({
  value,
  onChange,
  onCreaNuovo,
  placeholder = "Seleziona prodotto…",
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [prodotti, setProdotti] = React.useState<ProdottoConDettagli[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    listProdotti({ includiStandby: false })
      .then((d) => mounted && setProdotti(d))
      .catch(() => mounted && setProdotti([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [open]);

  const selected = prodotti.find((p) => p.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span className="truncate">{selected.nome}</span>
              <Badge variant="outline" className={cn("text-[10px]", MODALITA_BADGE[selected.modalita_tracking])}>
                {MODALITA_LABELS[selected.modalita_tracking]}
              </Badge>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Cerca prodotto…" />
          <CommandList>
            <CommandEmpty>{loading ? "Caricamento…" : "Nessun prodotto trovato"}</CommandEmpty>
            <CommandGroup>
              {prodotti.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.nome} ${p.tipologia ?? ""}`}
                  onSelect={() => {
                    onChange(p.id, p);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  <span className="flex-1 truncate">{p.nome}</span>
                  <Badge variant="outline" className={cn("ml-2 text-[10px]", MODALITA_BADGE[p.modalita_tracking])}>
                    {MODALITA_LABELS[p.modalita_tracking]}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreaNuovo && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      onCreaNuovo();
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nuovo prodotto…
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
