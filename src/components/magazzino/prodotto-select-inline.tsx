import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ModalitaTracking, ProdottoConDettagli } from "@/types/magazzino";
import { MODALITA_LABELS } from "@/types/magazzino";

interface Props {
  prodotti: ProdottoConDettagli[];
  value: string | null;
  onChange: (id: string | null, p: ProdottoConDettagli | null) => void;
  onCreaNuovo?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

const NEW_VALUE = "__new__";

const MODALITA_BADGE: Record<ModalitaTracking, string> = {
  tracciato: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  solo_uso: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  standby: "bg-muted text-muted-foreground",
};

/**
 * Selettore prodotto leggero per uso INLINE in un Dialog.
 * Usa solo Radix Select (no cmdk/Popover) per evitare conflitti
 * di portal/focus che generano errori React in dialog annidati.
 */
export function ProdottoSelectInline({
  prodotti,
  value,
  onChange,
  onCreaNuovo,
  loading,
  disabled,
}: Props) {
  const [filter, setFilter] = React.useState("");

  const filtrati = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return prodotti;
    return prodotti.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.tipologia ?? "").toLowerCase().includes(q),
    );
  }, [prodotti, filter]);

  function handleChange(v: string) {
    if (v === NEW_VALUE) {
      onCreaNuovo?.();
      return;
    }
    const p = prodotti.find((x) => x.id === v) ?? null;
    onChange(v || null, p);
  }

  return (
    <div className="space-y-1">
      <Input
        placeholder="Cerca…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="h-8 text-xs"
        disabled={disabled}
      />
      <Select
        value={value ?? undefined}
        onValueChange={handleChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder={loading ? "Caricamento…" : "Seleziona prodotto"} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {filtrati.length === 0 && (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">
              {loading ? "Caricamento…" : "Nessun prodotto"}
            </div>
          )}
          {filtrati.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <span className="flex items-center gap-2">
                <span className="truncate">{p.nome}</span>
                <Badge
                  variant="outline"
                  className={cn("text-[10px]", MODALITA_BADGE[p.modalita_tracking])}
                >
                  {MODALITA_LABELS[p.modalita_tracking]}
                </Badge>
              </span>
            </SelectItem>
          ))}
          {onCreaNuovo && (
            <SelectItem value={NEW_VALUE}>
              <span className="flex items-center gap-2 text-primary">
                <Plus className="h-3.5 w-3.5" /> Nuovo prodotto…
              </span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
