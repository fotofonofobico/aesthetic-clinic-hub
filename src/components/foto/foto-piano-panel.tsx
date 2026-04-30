import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Camera, Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  listFotoByPiano,
  getStatoPiano,
  riapriPiano,
} from "@/lib/foto-clinica";
import type { FotoClinica, PianoFotoStatoRow } from "@/types/foto-clinica";
import { FotoStatoBadge } from "./foto-stato-badge";
import { FotoUploadDialog } from "./foto-upload-dialog";
import { FotoGrid } from "./foto-grid";

interface Props {
  paziente_id: string;
  piano_id: string;
  piano_titolo?: string;
}

export function FotoPianoPanel({ paziente_id, piano_id, piano_titolo }: Props) {
  const { user } = useAuth();
  const [foto, setFoto] = useState<FotoClinica[]>([]);
  const [stato, setStato] = useState<PianoFotoStatoRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadDefault, setUploadDefault] = useState<"prima" | "dopo">("prima");
  const [isMedico, setIsMedico] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "medico" })
      .then(({ data }) => setIsMedico(!!data));
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, s] = await Promise.all([
        listFotoByPiano(piano_id),
        getStatoPiano(piano_id),
      ]);
      setFoto(f);
      setStato(s);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [piano_id]);

  useEffect(() => {
    void load();
  }, [load]);

  const baselinePrima = useMemo(
    () => foto.filter((f) => f.livello === "piano" && f.momento === "prima"),
    [foto],
  );
  const finaliDopo = useMemo(
    () => foto.filter((f) => f.livello === "piano" && f.momento === "dopo"),
    [foto],
  );
  const sedute = useMemo(() => foto.filter((f) => f.livello === "seduta"), [foto]);

  function apriUpload(m: "prima" | "dopo") {
    setUploadDefault(m);
    setUploadOpen(true);
  }

  async function handleRiapri() {
    if (!confirm('Riaprire questo piano? Lo stato tornerà "Foto PRIMA mancante".')) return;
    try {
      await riapriPiano(piano_id);
      toast.success("Piano riaperto");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-base font-semibold">
            Foto cliniche
            {piano_titolo ? <span className="text-muted-foreground"> · {piano_titolo}</span> : null}
          </h3>
          {stato && (
            <FotoStatoBadge stato={stato.stato} incoerenza={stato.incoerenza_data} />
          )}
          <div className="ml-auto flex gap-2">
            {stato?.stato === "non_eseguibile" && isMedico && (
              <Button size="sm" variant="ghost" onClick={handleRiapri}>
                <RotateCcw className="h-4 w-4" /> Riapri
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => apriUpload("dopo")}>
              <Camera className="h-4 w-4" /> + DOPO
            </Button>
            <Button size="sm" onClick={() => apriUpload("prima")}>
              <Camera className="h-4 w-4" /> + Baseline (PRIMA)
            </Button>
          </div>
        </div>

        {stato?.stato === "non_eseguibile" && stato.motivazione && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Non eseguibile</AlertTitle>
            <AlertDescription>{stato.motivazione}</AlertDescription>
          </Alert>
        )}

        {stato?.incoerenza_data && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Foto baseline incoerenti</AlertTitle>
            <AlertDescription>
              Esistono foto PRIMA con data successiva alla prima seduta. Non vengono
              considerate baseline valide. Carica una foto con data antecedente o
              uguale alla prima seduta per chiudere lo stato.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <section className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Baseline (PRIMA piano)
              </h4>
              <FotoGrid
                foto={baselinePrima}
                canDelete={isMedico}
                onDeleted={() => void load()}
                emptyHint="Nessuna foto baseline. Carica le foto PRIMA per chiudere lo stato."
              />
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Finali (DOPO piano)
              </h4>
              <FotoGrid
                foto={finaliDopo}
                canDelete={isMedico}
                onDeleted={() => void load()}
                emptyHint="Nessuna foto finale."
              />
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Foto sedute
              </h4>
              <FotoGrid
                foto={sedute}
                canDelete={isMedico}
                onDeleted={() => void load()}
                emptyHint="Nessuna foto associata a sedute."
              />
            </section>
          </div>
        )}

        <FotoUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          paziente_id={paziente_id}
          piano_id={piano_id}
          defaultMomento={uploadDefault}
          onUploaded={() => void load()}
        />
      </CardContent>
    </Card>
  );
}
