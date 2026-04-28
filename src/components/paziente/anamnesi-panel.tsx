import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  computeAutoFlags,
  type AnamnesiPayload,
  type AnamnesiGenerale,
  type AnamnesiPatologica,
  type AnamnesiFarmacologica,
  type AnamnesiEstetica,
} from "@/lib/flag-rischio";
import type { Sesso } from "@/types/clinico";
import { AnamnesiCronologia } from "./anamnesi-cronologia";
import { generaPdfAnamnesi } from "@/lib/pdf-anamnesi";
import { Lock, FileSignature } from "lucide-react";

interface AnamnesiRow {
  id: string;
  paziente_id: string;
  generale: AnamnesiGenerale | null;
  patologica: AnamnesiPatologica | null;
  farmacologica: AnamnesiFarmacologica | null;
  estetica: AnamnesiEstetica | null;
  note_libere: string | null;
  updated_at: string;
  stato: "draft" | "signed" | "superseded";
  versione_numero: number;
  firmata_il: string | null;
  pdf_url: string | null;
  hash_integrita: string | null;
}

const PATOLOGIE = [
  { k: "diabete", l: "Diabete" },
  { k: "ipertensione", l: "Ipertensione" },
  { k: "tiroide", l: "Patologie tiroidee" },
  { k: "cardiopatia", l: "Cardiopatie" },
  { k: "varici", l: "Varici arti inferiori" },
  { k: "coagulopatia", l: "Coagulopatie / patologie ematologiche" },
  { k: "asma_bpco", l: "Asma / BPCO" },
  { k: "oncologico_attivo", l: "Oncologico attivo" },
  { k: "neoplasia_pregressa", l: "Neoplasia pregressa" },
  { k: "autoimmune", l: "Malattie autoimmuni" },
  { k: "cheloidi", l: "Cheloidi" },
  { k: "dermatopatie", l: "Dermatopatie" },
  { k: "hsv", l: "HSV (Herpes simplex)" },
  { k: "altro", l: "Altro" },
] as const;

const TERAPIE = [
  { k: "anticoagulanti", l: "Anticoagulante / antiaggregante" },
  { k: "cortisonici", l: "Cortisonica in corso" },
  { k: "isotretinoina", l: "Isotretinoina ultimi 6 mesi" },
  { k: "immunosoppressori", l: "Immunosoppressiva" },
  { k: "integratori", l: "Integratori / omeopatici" },
  { k: "altro", l: "Altro" },
] as const;

interface Props {
  pazienteId: string;
  sesso: Sesso | null;
  onSaved: () => void;
}

export function AnamnesiPanel({ pazienteId, sesso, onSaved }: Props) {
  const { user } = useAuth();
  const [data, setData] = useState<AnamnesiRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, [pazienteId]);

  async function load() {
    setLoading(true);
    const { data: row, error } = await supabase
      .from("anamnesi")
      .select("*")
      .eq("paziente_id", pazienteId)
      .maybeSingle();
    if (error) {
      toast.error(`Errore: ${error.message}`);
      setLoading(false);
      return;
    }
    setData(row as unknown as AnamnesiRow);
    setLoading(false);
  }

  function patch<S extends keyof AnamnesiPayload>(
    sez: S,
    patchObj: Partial<NonNullable<AnamnesiPayload[S]>>,
  ) {
    setData((d) => {
      if (!d) return d;
      const current = (d[sez] ?? {}) as Record<string, unknown>;
      return { ...d, [sez]: { ...current, ...patchObj } };
    });
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    const payload: AnamnesiPayload = {
      generale: data.generale ?? {},
      patologica: data.patologica ?? {},
      farmacologica: data.farmacologica ?? {},
      estetica: data.estetica ?? {},
    };
    const { error } = await supabase
      .from("anamnesi")
      .update({
        generale: (payload.generale ?? {}) as never,
        patologica: (payload.patologica ?? {}) as never,
        farmacologica: (payload.farmacologica ?? {}) as never,
        estetica: (payload.estetica ?? {}) as never,
        note_libere: data.note_libere,
        compilata_da: user?.id ?? null,
      })
      .eq("id", data.id);

    if (error) {
      toast.error(`Errore: ${error.message}`);
      setSaving(false);
      return;
    }

    // Ricalcola flag automatici
    const flags = computeAutoFlags(payload);
    await supabase
      .from("anamnesi_flag_rischio")
      .delete()
      .eq("paziente_id", pazienteId)
      .eq("origine", "auto");
    if (flags.length > 0) {
      await supabase.from("anamnesi_flag_rischio").insert(
        flags.map((f) => ({
          paziente_id: pazienteId,
          codice: f.codice,
          etichetta: f.etichetta,
          severity: f.severity,
          origine: "auto",
        })),
      );
    }

    toast.success("Anamnesi salvata");
    setSaving(false);
    onSaved();
  }

  if (loading || !data) {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  }

  const g = data.generale ?? {};
  const p = data.patologica ?? {};
  const fa = data.farmacologica ?? {};
  const es = data.estetica ?? {};

  return (
    <div className="space-y-4">
      {/* === 1. GENERALE === */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">1. Generale</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Allergie */}
          <YesNoConditional
            label="Allergie"
            value={g.allergie ?? false}
            onChange={(v) => patch("generale", { allergie: v })}
          >
            <FieldNote
              label="Note allergie"
              value={g.allergie_note ?? ""}
              onChange={(v) => patch("generale", { allergie_note: v })}
            />
          </YesNoConditional>

          {/* Lidocaina */}
          <YesNoRow
            label="Sensibilità lidocaina"
            value={g.lidocaina_sensibile ?? false}
            onChange={(v) => patch("generale", { lidocaina_sensibile: v })}
          />

          {/* Fumo / Alcol / Caffè */}
          <div className="grid gap-3 md:grid-cols-3">
            <TernaryRow
              label="Fumo"
              value={g.fumo ?? ""}
              onChange={(v) => patch("generale", { fumo: v })}
            />
            <TernaryRow
              label="Alcol"
              value={g.alcol ?? ""}
              onChange={(v) => patch("generale", { alcol: v })}
            />
            <TernaryRow
              label="Caffè"
              value={g.caffe ?? ""}
              onChange={(v) => patch("generale", { caffe: v })}
            />
          </div>

          {/* Sport */}
          <YesNoConditional
            label="Sport"
            value={g.sport ?? false}
            onChange={(v) => patch("generale", { sport: v })}
          >
            <FieldNote
              label="Note sport"
              value={g.sport_note ?? ""}
              onChange={(v) => patch("generale", { sport_note: v })}
            />
          </YesNoConditional>

          {/* Alimentazione + Acqua */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Alimentazione</Label>
              <Select
                value={g.alimentazione || "_none"}
                onValueChange={(v) =>
                  patch("generale", {
                    alimentazione:
                      v === "_none"
                        ? ""
                        : (v as "sana" | "abbastanza" | "disequilibrata"),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  <SelectItem value="sana">Sana ed equilibrata</SelectItem>
                  <SelectItem value="abbastanza">Abbastanza equilibrata</SelectItem>
                  <SelectItem value="disequilibrata">Disequilibrata</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Acqua (litri/die)</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={g.acqua_litri ?? ""}
                onChange={(e) =>
                  patch("generale", {
                    acqua_litri: e.target.value === "" ? null : parseFloat(e.target.value),
                  })
                }
              />
            </div>
          </div>

          {/* Condizioni ormonali — solo se F */}
          {sesso === "F" && (
            <div className="space-y-2">
              <Label className="text-sm">Condizioni ormonali</Label>
              <RadioGroup
                value={g.condizioni_ormonali || "nessuna"}
                onValueChange={(v) =>
                  patch("generale", {
                    condizioni_ormonali: v as
                      | "nessuna"
                      | "gravidanza"
                      | "allattamento"
                      | "menopausa",
                  })
                }
                className="grid gap-2 md:grid-cols-4"
              >
                {[
                  { v: "nessuna", l: "Nessuna" },
                  { v: "gravidanza", l: "Gravidanza" },
                  { v: "allattamento", l: "Allattamento" },
                  { v: "menopausa", l: "Menopausa" },
                ].map((o) => (
                  <label
                    key={o.v}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-3 hover:bg-accent/40"
                  >
                    <RadioGroupItem value={o.v} />
                    <span className="text-sm">{o.l}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Vaccinazione 14gg */}
          <YesNoConditional
            label="Vaccinazione ultimi 14 giorni"
            value={g.vaccino_recente ?? false}
            onChange={(v) => patch("generale", { vaccino_recente: v })}
          >
            <FieldNote
              label="Note vaccino"
              value={g.vaccino_note ?? ""}
              onChange={(v) => patch("generale", { vaccino_note: v })}
            />
          </YesNoConditional>
        </CardContent>
      </Card>

      {/* === 2. PATOLOGICA === */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">2. Patologica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <YesNoRow
            label="Presenza patologie"
            value={p.presenti ?? false}
            onChange={(v) => patch("patologica", { presenti: v })}
          />

          {p.presenti && (
            <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
              <Label className="text-sm">Seleziona patologie</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {PATOLOGIE.map((pat) => (
                  <label
                    key={pat.k}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card p-2"
                  >
                    <Checkbox
                      checked={
                        !!(p as Record<string, unknown>)[pat.k]
                      }
                      onCheckedChange={(v) =>
                        patch("patologica", { [pat.k]: !!v } as Partial<AnamnesiPatologica>)
                      }
                    />
                    <span className="text-sm">{pat.l}</span>
                  </label>
                ))}
              </div>
              {p.altro && (
                <FieldNote
                  label="Specifica altra patologia"
                  value={p.altro_note ?? ""}
                  onChange={(v) => patch("patologica", { altro_note: v })}
                />
              )}
            </div>
          )}

          <YesNoConditional
            label="Interventi chirurgici / traumi"
            value={p.interventi ?? false}
            onChange={(v) => patch("patologica", { interventi: v })}
          >
            <InterventiBlock p={p} patch={(obj) => patch("patologica", obj)} />
          </YesNoConditional>
        </CardContent>
      </Card>

      {/* === 3. FARMACI === */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">3. Terapie / Farmaci</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <YesNoRow
            label="Terapie in corso"
            value={fa.presenti ?? false}
            onChange={(v) => patch("farmacologica", { presenti: v })}
          />

          {fa.presenti && (
            <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
              <Label className="text-sm">Seleziona terapie</Label>
              <div className="grid gap-2 md:grid-cols-2">
                {TERAPIE.map((t) => (
                  <label
                    key={t.k}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card p-2"
                  >
                    <Checkbox
                      checked={
                        !!(fa as Record<string, unknown>)[t.k]
                      }
                      onCheckedChange={(v) =>
                        patch("farmacologica", { [t.k]: !!v } as Partial<AnamnesiFarmacologica>)
                      }
                    />
                    <span className="text-sm">{t.l}</span>
                  </label>
                ))}
              </div>
              {fa.altro && (
                <FieldNote
                  label="Specifica altra terapia"
                  value={fa.altro_note ?? ""}
                  onChange={(v) => patch("farmacologica", { altro_note: v })}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* === 4. ESTETICA === */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">4. Estetica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm">Fototipo</Label>
              <Select
                value={es.fototipo || "_none"}
                onValueChange={(v) =>
                  patch("estetica", {
                    fototipo:
                      v === "_none" ? "" : (v as "I" | "II" | "III" | "IV" | "V" | "VI"),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {(["I", "II", "III", "IV", "V", "VI"] as const).map((f) => (
                    <SelectItem key={f} value={f}>
                      Fototipo {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Texture cutanea</Label>
              <Select
                value={es.texture || "_none"}
                onValueChange={(v) =>
                  patch("estetica", {
                    texture:
                      v === "_none"
                        ? ""
                        : (v as "omogenea" | "parziale" | "disomogenea"),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  <SelectItem value="omogenea">Omogenea</SelectItem>
                  <SelectItem value="parziale">Parziale</SelectItem>
                  <SelectItem value="disomogenea">Disomogenea</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <FlagBox
              label="Abbronzatura in corso"
              checked={es.abbronzatura ?? false}
              onChange={(v) => patch("estetica", { abbronzatura: v })}
            />
            <FlagBox
              label="Elastosi cutanea"
              checked={es.elastosi ?? false}
              onChange={(v) => patch("estetica", { elastosi: v })}
            />
            <FlagBox
              label="Uso abituale di SPF"
              checked={es.spf_uso ?? false}
              onChange={(v) => patch("estetica", { spf_uso: v })}
            />
          </div>

          <YesNoConditional
            label="Trattamenti pregressi"
            value={es.trattamenti_pregressi ?? false}
            onChange={(v) => patch("estetica", { trattamenti_pregressi: v })}
          >
            <FieldNote
              label="Note trattamenti pregressi"
              value={es.trattamenti_pregressi_note ?? ""}
              onChange={(v) => patch("estetica", { trattamenti_pregressi_note: v })}
            />
          </YesNoConditional>

          <YesNoConditional
            label="Reazioni a trattamenti precedenti"
            value={es.reazioni_pregresse ?? false}
            onChange={(v) => patch("estetica", { reazioni_pregresse: v })}
          >
            <FieldNote
              label="Note reazioni"
              value={es.reazioni_pregresse_note ?? ""}
              onChange={(v) => patch("estetica", { reazioni_pregresse_note: v })}
            />
          </YesNoConditional>
        </CardContent>
      </Card>

      {/* === Note libere === */}
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-base">Note libere</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={4}
            value={data.note_libere ?? ""}
            onChange={(e) =>
              setData((d) => (d ? { ...d, note_libere: e.target.value } : d))
            }
            placeholder="Annotazioni anamnestiche aggiuntive…"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Salvataggio…" : "Salva anamnesi"}
        </Button>
      </div>

      {/* Cronologia */}
      <AnamnesiCronologia pazienteId={pazienteId} />
    </div>
  );
}

// ===== sub-components =====

function YesNoRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
      <span className="text-sm">{label}</span>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant={value === false ? "default" : "outline"}
          onClick={() => onChange(false)}
          className="min-w-[64px]"
        >
          No
        </Button>
        <Button
          type="button"
          size="sm"
          variant={value === true ? "default" : "outline"}
          onClick={() => onChange(true)}
          className="min-w-[64px]"
        >
          Sì
        </Button>
      </div>
    </div>
  );
}

const INTERVENTI_TIPI = [
  { k: "maggiore", l: "Chirurgia maggiore (addominale / tiroidea / bariatrica)" },
  { k: "traumi", l: "Traumi / fratture" },
  { k: "estetica", l: "Chirurgia estetica" },
  { k: "dermatologica", l: "Chirurgia dermatologica / cutanea" },
  { k: "altro", l: "Altro" },
] as const;

function InterventiBlock({
  p,
  patch,
}: {
  p: AnamnesiPatologica;
  patch: (obj: Partial<AnamnesiPatologica>) => void;
}) {
  const tipi = p.interventi_tipi ?? {};
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <Label className="text-sm">Tipologia (selezione multipla)</Label>
      <div className="grid gap-2 md:grid-cols-2">
        {INTERVENTI_TIPI.map((it) => (
          <label
            key={it.k}
            className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-card p-2"
          >
            <Checkbox
              checked={!!(tipi as Record<string, unknown>)[it.k]}
              onCheckedChange={(v) =>
                patch({
                  interventi_tipi: { ...tipi, [it.k]: !!v },
                })
              }
            />
            <span className="text-sm">{it.l}</span>
          </label>
        ))}
      </div>
      {tipi.altro && (
        <FieldNote
          label="Specifica (altro)"
          value={p.interventi_altro_note ?? ""}
          onChange={(v) => patch({ interventi_altro_note: v })}
        />
      )}
    </div>
  );
}

function YesNoConditional({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <YesNoRow label={label} value={value} onChange={onChange} />
      {value && <div className="pl-3">{children}</div>}
    </div>
  );
}

function TernaryRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "si" | "no" | "occasionale" | "";
  onChange: (v: "si" | "no" | "occasionale" | "") => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <Label className="text-sm">{label}</Label>
      <div className="flex gap-1">
        {[
          { v: "no" as const, l: "No" },
          { v: "occasionale" as const, l: "Occas." },
          { v: "si" as const, l: "Sì" },
        ].map((o) => (
          <Button
            key={o.v}
            type="button"
            size="sm"
            variant={value === o.v ? "default" : "outline"}
            onClick={() => onChange(value === o.v ? "" : o.v)}
            className="flex-1"
          >
            {o.l}
          </Button>
        ))}
      </div>
    </div>
  );
}

function FlagBox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-3 hover:bg-accent/40">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function FieldNote({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
