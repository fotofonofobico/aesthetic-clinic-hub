import { useEffect, useState } from "react";
import { getStatoPiano } from "@/lib/foto-clinica";
import type { PianoFotoStatoRow } from "@/types/foto-clinica";
import { FotoStatoBadge } from "./foto-stato-badge";

/** Wrapper che carica lo stato foto del piano e renderizza il badge. */
export function FotoStatoBadgeLive({ piano_id }: { piano_id: string }) {
  const [row, setRow] = useState<PianoFotoStatoRow | null>(null);

  useEffect(() => {
    let mounted = true;
    getStatoPiano(piano_id)
      .then((r) => mounted && setRow(r))
      .catch(() => mounted && setRow(null));
    return () => {
      mounted = false;
    };
  }, [piano_id]);

  if (!row) return null;
  return <FotoStatoBadge stato={row.stato} incoerenza={row.incoerenza_data} />;
}
