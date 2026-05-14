import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Save } from "lucide-react";
import { toast } from "sonner";
import { calcolaBmi } from "@/lib/bmi";

export function MetricheCorporeeCard({
  pazienteId,
  pesoKg,
  altezzaCm,
  onSaved,
}: {
  pazienteId: string;
  pesoKg: number | null;
  altezzaCm: number | null;
  onSaved?: () => void;
}) {
  const [peso, setPeso] = useState<string>(pesoKg != null ? String(pesoKg) : "");
  const [altezza, setAltezza] = useState<string>(altezzaCm != null ? String(altezzaCm) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPeso(pesoKg != null ? String(pesoKg) : "");
    setAltezza(altezzaCm != null ? String(altezzaCm) : "");
  }, [pesoKg, altezzaCm]);

  const pesoNum = peso.trim() === "" ? null : Number(peso.replace(",", "."));
  const altezzaNum = altezza.trim() === "" ? null : Math.round(Number(altezza.replace(",", ".")));
  const bmi = calcolaBmi(pesoNum, altezzaNum);

  const dirty =
    (pesoNum ?? null) !== (pesoKg ?? null) ||
    (altezzaNum ?? null) !== (altezzaCm ?? null);

  async function salva() {
    setSaving(true);
    const { error } = await supabase
      .from("pazienti")
      .update({
        peso_kg: pesoNum,
        altezza_cm: altezzaNum,
      })
      .eq("id", pazienteId);
    setSaving(false);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    toast.success("Metriche aggiornate");
    onSaved?.();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Metriche corporee
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Peso (kg)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={peso}
              onChange={(e) => setPeso(e.target.value)}
              placeholder="es. 68.5"
            />
          </div>
          <div className="space-y-2">
            <Label>Altezza (cm)</Label>
            <Input
              type="number"
              step="1"
              min="0"
              value={altezza}
              onChange={(e) => setAltezza(e.target.value)}
              placeholder="es. 170"
            />
          </div>
          <div className="space-y-2">
            <Label>BMI</Label>
            {bmi ? (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                <span className="font-semibold">{bmi.value}</span>
                <span className="ml-2 text-muted-foreground">· {bmi.label}</span>
              </div>
            ) : (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/20 px-3 text-xs text-muted-foreground">
                Inserisci peso e altezza
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => void salva()} disabled={saving || !dirty}>
            <Save className="h-4 w-4" />
            {saving ? "Salvataggio…" : "Salva metriche"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
