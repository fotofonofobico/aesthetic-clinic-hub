import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Camera, Ban, Play } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { marcaNonEseguibile } from "@/lib/foto-clinica";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  piano_id: string;
  paziente_id: string;
  /** Chiamato quando l'utente sceglie "Procedi comunque" */
  onProcedi: () => void;
  /** Chiamato quando l'utente sceglie "Carica baseline ora" */
  onCarica: () => void;
  /** Chiamato dopo che il piano è stato marcato non eseguibile */
  onNonEseguibile?: () => void;
  incoerenza?: boolean;
}

export function FotoBaselineDialog({
  open,
  onOpenChange,
  piano_id,
  onProcedi,
  onCarica,
  onNonEseguibile,
  incoerenza,
}: Props) {
  const { user } = useAuth();
  const [isMedico, setIsMedico] = useState(false);
  const [showMotivo, setShowMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "medico" })
      .then(({ data }) => {
        if (mounted) setIsMedico(!!data);
      });
    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (open) {
      setShowMotivo(false);
      setMotivo("");
    }
  }, [open]);

  async function handleNonEseguibile() {
    if (motivo.trim().length < 5) {
      toast.error("Motivazione di almeno 5 caratteri");
      return;
    }
    setSaving(true);
    try {
      await marcaNonEseguibile(piano_id, motivo.trim());
      toast.success("Piano marcato come non eseguibile");
      onNonEseguibile?.();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Foto baseline mancanti
          </DialogTitle>
          <DialogDescription>
            Per questo piano non sono ancora state caricate foto PRIMA del trattamento.
          </DialogDescription>
        </DialogHeader>

        {incoerenza && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Incoerenza data</AlertTitle>
            <AlertDescription>
              Sono presenti foto PRIMA con data successiva alla prima seduta:
              non valide come baseline.
            </AlertDescription>
          </Alert>
        )}

        {!showMotivo ? (
          <>
            <p className="text-sm text-muted-foreground">
              Puoi procedere comunque (il piano resterà marcato come{" "}
              <strong>Foto PRIMA mancante</strong> finché non carichi le foto), oppure
              caricarle ora.
            </p>
            <DialogFooter className="flex w-full flex-col gap-2 sm:flex-col">
              <div className="flex w-full flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={onProcedi} className="w-full sm:flex-1">
                  <Play className="h-4 w-4" />
                  Procedi comunque
                </Button>
                <Button onClick={onCarica} className="w-full sm:flex-1">
                  <Camera className="h-4 w-4" />
                  Carica baseline ora
                </Button>
              </div>
              {isMedico && (
                <Button
                  variant="ghost"
                  onClick={() => setShowMotivo(true)}
                  className="w-full"
                >
                  <Ban className="h-4 w-4" />
                  Marca non eseguibile
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivazione (obbligatoria)</Label>
              <Textarea
                id="motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Es: paziente non consenziente alle foto, zona non fotografabile…"
                rows={3}
                maxLength={500}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowMotivo(false)} disabled={saving}>
                Indietro
              </Button>
              <Button variant="destructive" onClick={handleNonEseguibile} disabled={saving}>
                Conferma "Non eseguibile"
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
