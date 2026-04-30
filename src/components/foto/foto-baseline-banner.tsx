import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Camera, AlertTriangle } from "lucide-react";

interface Props {
  paziente_id: string;
  onClickPiano?: () => void;
}

export function FotoBaselineBanner({ paziente_id, onClickPiano }: Props) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: piani } = await supabase
        .from("piano_trattamento")
        .select("id")
        .eq("paziente_id", paziente_id)
        .not("stato", "in", "(bozza,annullato)");
      const ids = (piani ?? []).map((p) => (p as { id: string }).id);
      if (ids.length === 0) {
        if (mounted) setCount(0);
        return;
      }
      const { data: stati } = await supabase
        .from("piano_foto_stato")
        .select("piano_id, stato")
        .in("piano_id", ids)
        .eq("stato", "baseline_mancante");
      if (mounted) setCount((stati ?? []).length);
    })();
    return () => {
      mounted = false;
    };
  }, [paziente_id]);

  if (count === 0) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 sm:items-center"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 sm:mt-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">Foto baseline mancanti</p>
        <p className="mt-0.5 break-words text-xs text-muted-foreground">
          {count} {count === 1 ? "piano" : "piani"} senza foto pre‑trattamento.
        </p>
      </div>
      {onClickPiano && (
        <Button size="sm" variant="outline" onClick={onClickPiano} className="shrink-0">
          <Camera className="h-4 w-4" />
          Gestisci
        </Button>
      )}
    </div>
  );
}
