import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

interface PazienteMin {
  id: string;
  nome: string;
  cognome: string;
}

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowNone?: boolean;
}

export function PazienteSearch({
  value,
  onChange,
  placeholder = "Cerca paziente…",
  disabled,
  allowNone = true,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PazienteMin[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<PazienteMin | null>(null);

  // carica paziente selezionato (per mostrare etichetta)
  React.useEffect(() => {
    if (!value) {
      setSelected(null);
      return;
    }
    if (selected?.id === value) return;
    let cancelled = false;
    supabase
      .from("pazienti")
      .select("id, nome, cognome")
      .eq("id", value)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setSelected(data as PazienteMin);
      });
    return () => {
      cancelled = true;
    };
  }, [value, selected?.id]);

  // ricerca con debounce
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      let q = supabase
        .from("pazienti")
        .select("id, nome, cognome")
        .order("cognome")
        .limit(20);
      const term = query.trim();
      if (term) {
        q = q.or(`cognome.ilike.%${term}%,nome.ilike.%${term}%`);
      }
      const { data } = await q;
      setResults((data ?? []) as PazienteMin[]);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

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
            <span className="truncate">
              {selected.cognome} {selected.nome}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[260px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Cerca per cognome o nome…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{loading ? "Caricamento…" : "Nessun paziente"}</CommandEmpty>
            {allowNone && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onChange(null);
                    setSelected(null);
                    setOpen(false);
                  }}
                >
                  <X className="mr-2 h-4 w-4 opacity-50" />
                  <span className="text-muted-foreground">Nessuno</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {results.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onChange(p.id);
                    setSelected(p);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">
                    {p.cognome} {p.nome}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
