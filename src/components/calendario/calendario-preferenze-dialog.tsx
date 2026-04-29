import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CalendarioPreferenzeDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [followupAttivo, setFollowupAttivo] = useState(false);
  const [followupGiorni, setFollowupGiorni] = useState(7);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase
      .from("calendario_preferenze")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setFollowupAttivo(data.followup_auto_attivo);
          setFollowupGiorni(data.followup_giorni_offset);
        }
        setLoading(false);
      });
  }, [open, user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("calendario_preferenze")
        .upsert({
          user_id: user.id,
          followup_auto_attivo: followupAttivo,
          followup_giorni_offset: followupGiorni,
          vista_default: "settimana",
        });
      if (error) throw error;
      toast.success("Preferenze salvate");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Errore");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Preferenze calendario</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm font-medium">Follow-up automatici</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Crea un promemoria nel calendario dopo ogni seduta completata.
                </p>
              </div>
              <Switch checked={followupAttivo} onCheckedChange={setFollowupAttivo} />
            </div>

            {followupAttivo && (
              <div className="space-y-1">
                <Label htmlFor="off">Giorni dopo la seduta</Label>
                <Input
                  id="off"
                  type="number"
                  min={1}
                  max={365}
                  value={followupGiorni}
                  onChange={(e) => setFollowupGiorni(Math.max(1, parseInt(e.target.value) || 7))}
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
