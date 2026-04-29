import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
        .eq("paziente_id", paziente_id);
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
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle>Foto baseline mancanti</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span>
          {count} {count === 1 ? "piano" : "piani"} senza foto PRIMA del trattamento.
        </span>
        {onClickPiano && (
          <Button size="sm" variant="outline" onClick={onClickPiano}>
            <Camera className="h-4 w-4" /> Gestisci foto
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
