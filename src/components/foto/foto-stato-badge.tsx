import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Ban } from "lucide-react";
import type { PianoFotoStato } from "@/types/foto-clinica";
import { PIANO_FOTO_STATO_LABELS } from "@/types/foto-clinica";

export function FotoStatoBadge({
  stato,
  incoerenza,
  className,
}: {
  stato: PianoFotoStato;
  incoerenza?: boolean;
  className?: string;
}) {
  if (stato === "completo") {
    return (
      <Badge variant="secondary" className={className}>
        <CheckCircle2 className="h-3 w-3" />
        Foto: {PIANO_FOTO_STATO_LABELS.completo}
      </Badge>
    );
  }
  if (stato === "non_eseguibile") {
    return (
      <Badge variant="outline" className={className}>
        <Ban className="h-3 w-3" />
        {PIANO_FOTO_STATO_LABELS.non_eseguibile}
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className={className}>
      <AlertTriangle className="h-3 w-3" />
      {PIANO_FOTO_STATO_LABELS.baseline_mancante}
      {incoerenza ? " (incoerenza data)" : ""}
    </Badge>
  );
}
