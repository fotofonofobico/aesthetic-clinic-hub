import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { FiltriCalendario } from "@/hooks/use-calendario-eventi";

interface Props {
  filtri: FiltriCalendario;
  onChange: (f: FiltriCalendario) => void;
}

export function CalendarioFiltri({ filtri, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <FiltroItem
        id="f-sed"
        label="Sedute"
        color="hsl(217 91% 60%)"
        checked={filtri.mostraSedute}
        onChange={(v) => onChange({ ...filtri, mostraSedute: v })}
      />
      <FiltroItem
        id="f-ev"
        label="Eventi"
        color="hsl(var(--primary))"
        checked={filtri.mostraEventi}
        onChange={(v) => onChange({ ...filtri, mostraEventi: v })}
      />
      <FiltroItem
        id="f-sc"
        label="Scadenze lotti"
        color="hsl(38 92% 50%)"
        checked={filtri.mostraScadenze}
        onChange={(v) => onChange({ ...filtri, mostraScadenze: v })}
      />
    </div>
  );
}

function FiltroItem({
  id, label, color, checked, onChange,
}: { id: string; label: string; color: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <Label htmlFor={id} className="flex cursor-pointer items-center gap-1.5 font-normal">
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        {label}
      </Label>
    </div>
  );
}
