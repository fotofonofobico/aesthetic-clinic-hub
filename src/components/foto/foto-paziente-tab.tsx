import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import type { PianoTrattamento } from "@/types/trattamenti";
import { FotoPianoPanel } from "./foto-piano-panel";

interface Props {
  paziente_id: string;
}

export function FotoPazienteTab({ paziente_id }: Props) {
  const [piani, setPiani] = useState<PianoTrattamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    supabase
      .from("piano_trattamento")
      .select("*")
      .eq("paziente_id", paziente_id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (mounted) {
          setPiani((data ?? []) as unknown as PianoTrattamento[]);
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [paziente_id]);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (piani.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nessun piano di trattamento. Crea prima un piano per gestire le foto.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {piani.map((p) => (
        <FotoPianoPanel
          key={p.id}
          paziente_id={paziente_id}
          piano_id={p.id}
          piano_titolo={p.titolo}
        />
      ))}
    </div>
  );
}
