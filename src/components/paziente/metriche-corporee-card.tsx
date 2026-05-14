import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Save } from "lucide-react";
import { toast } from "sonner";
import { calcolaBmi } from "@/lib/bmi";

export function MetricheCorporeeCard({ pazienteId }: { pazienteId: string }) {
  const [peso, setPeso] = useState<string>("");
  const [altezza, setAltezza] = useState<string>("");
  const [originalPeso, setOriginalPeso] = useState<number | null>(null);
  const [originalAltezza, setOriginalAltezza] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("pazienti")
      .select("peso_kg, altezza_cm")
      .eq("id", pazienteId)
      .maybeSingle();
    const p = (data?.peso_kg as number | null) ?? null;
    const a = (data?.altezza_cm as number | null) ?? null;
    setOriginalPeso(p);
    setOriginalAltezza(a);
    setPeso(p != null ? String(p) : "");
    setAltezza(a != null ? String(a) : "");
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [pazienteId]);

  const pesoNum = peso.trim() === "" ? null : Number(peso.replace(",", "."));
  const altezzaNum =
    altezza.trim() === "" ? null : Math.round(Number(altezza.replace(",", ".")));
  const bmi = calcolaBmi(pesoNum, altezzaNum);
  const dirty = (pesoNum ?? null) !== originalPeso || (altezzaNum ?? null) !== originalAltezza;

  async function salva() {
    setSaving(true);
    const { error } = await supabase
      .from("pazienti")
      .update({ peso_kg: pesoNum, altezza_cm: altezzaNum })
      .eq("id", pazienteId);
    setSaving(false);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      return;
    }
    toast.success("Metriche aggiornate");
    void load();
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
              disabled={loading}
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
              disabled={loading}
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
          <Button size="sm" onClick={() => void salva()} disabled={saving || !dirty || loading}>
            <Save className="h-4 w-4" />
            {saving ? "Salvataggio…" : "Salva metriche"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
