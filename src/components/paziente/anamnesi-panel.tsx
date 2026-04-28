import * as React from "react";
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
import { Lock, FileSignature, History, Printer, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SignaturePadHandle } from "@/components/signature-pad";
import { PdfSignedLink } from "@/components/pdf-signed-link";
import { PdfBlobDialog } from "@/components/pdf-blob-dialog";

type ReactNode = React.ReactNode;

// Lazy-load SignaturePad: la lib (react-signature-canvas alpha) viene importata
// solo quando il dialog di firma si apre, riducendo la superficie di errori al mount.
const SignaturePad = React.lazy(() =>
  import("@/components/signature-pad").then((m) => ({ default: m.SignaturePad })),
);

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
  firma_paziente: string | null;
  firma_medico: string | null;
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
  const [data, setData] = React.useState<AnamnesiRow | null>(null);
  const [lastSigned, setLastSigned] = React.useState<AnamnesiRow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [signing, setSigning] = React.useState(false);
  const [forking, setForking] = React.useState(false);
  const [signDlgOpen, setSignDlgOpen] = React.useState(false);
  const [cartaceoDlgOpen, setCartaceoDlgOpen] = React.useState(false);
  const [draftPdfBlob, setDraftPdfBlob] = React.useState<Blob | null>(null);
  const [draftPdfOpen, setDraftPdfOpen] = React.useState(false);
  const [annullando, setAnnullando] = React.useState(false);
  const sigPazRef = React.useRef<SignaturePadHandle>(null);
  const sigMedRef = React.useRef<SignaturePadHandle>(null);
  // Lock per evitare fork concorrenti (es. utente digita veloce su record signed)
  const forkPromiseRef = React.useRef<Promise<AnamnesiRow | null> | null>(null);

  React.useEffect(() => {
    void load();
  }, [pazienteId]);

  async function load() {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("anamnesi")
      .select("*")
      .eq("paziente_id", pazienteId)
      .order("updated_at", { ascending: false });
    if (error) {
      toast.error(`Errore: ${error.message}`);
      setLoading(false);
      return;
    }
    const list = (rows ?? []) as unknown as AnamnesiRow[];
    const draft = list.find((r) => r.stato === "draft");
    const signed = list.find((r) => r.stato === "signed") ?? null;
    setLastSigned(signed);
    setData(draft ?? signed ?? list[0] ?? null);
    setLoading(false);
  }

  async function annullaModifiche() {
    if (!data || data.stato !== "draft" || !lastSigned) return;
    if (
      !confirm(
        `Eliminare le modifiche correnti e ripristinare l'ultima versione firmata (v${lastSigned.versione_numero})?`,
      )
    )
      return;
    setAnnullando(true);
    const { error } = await supabase.from("anamnesi").delete().eq("id", data.id);
    if (error) {
      toast.error(`Errore: ${error.message}`);
      setAnnullando(false);
      return;
    }
    toast.success(`Modifiche annullate, ripristinata v${lastSigned.versione_numero}`);
    await load();
    onSaved();
    setAnnullando(false);
  }

  /**
   * Crea (e ritorna) una nuova versione draft a partire dall'attuale firmata.
   * Chiamata automaticamente al primo edit su un'anamnesi firmata.
   */
  async function forkFromSigned(base: AnamnesiRow): Promise<AnamnesiRow | null> {
    if (forking) return null;
    setForking(true);
    try {
      const { data: created, error } = await supabase
        .from("anamnesi")
        .insert({
          paziente_id: pazienteId,
          generale: (base.generale ?? {}) as never,
          patologica: (base.patologica ?? {}) as never,
          farmacologica: (base.farmacologica ?? {}) as never,
          estetica: (base.estetica ?? {}) as never,
          note_libere: base.note_libere,
          compilata_da: user?.id ?? null,
          versione_numero: (base.versione_numero ?? 1) + 1,
        })
        .select("*")
        .single();
      if (error || !created) {
        toast.error(`Errore creazione versione: ${error?.message ?? "n/d"}`);
        return null;
      }
      toast.success(`Creata bozza v${(base.versione_numero ?? 1) + 1} da v${base.versione_numero}`);
      return created as unknown as AnamnesiRow;
    } finally {
      setForking(false);
    }
  }

  /**
   * Wrapper per modifiche: se l'attuale è firmata, crea prima un draft, poi applica la patch.
   * Restituisce l'eventuale draft appena creato (così altri update possono usarlo subito).
   */
  async function ensureEditable(): Promise<AnamnesiRow | null> {
    if (!data) return null;
    if (data.stato !== "signed") return data;
    // Fork lock: se è già in corso un fork, riusa la stessa promise.
    // Evita corse e violazioni dell'unique index `anamnesi_one_draft_per_paziente`.
    if (forkPromiseRef.current) {
      return forkPromiseRef.current;
    }
    const p = forkFromSigned(data).then((draft) => {
      if (draft) setData(draft);
      forkPromiseRef.current = null;
      return draft;
    });
    forkPromiseRef.current = p;
    return p;
  }

  async function patch<S extends keyof AnamnesiPayload>(
    sez: S,
    patchObj: Partial<NonNullable<AnamnesiPayload[S]>>,
  ) {
    const editable = await ensureEditable();
    if (!editable) return;
    setData((d: AnamnesiRow | null) => {
      // Usa SEMPRE editable come base (può essere il nuovo draft appena forkato)
      // per evitare di applicare patch sul vecchio record signed.
      const target = d && d.id === editable.id ? d : editable;
      const current = (target[sez] ?? {}) as Record<string, unknown>;
      return { ...target, [sez]: { ...current, ...patchObj } };
    });
  }

  async function setNoteLibere(v: string) {
    const editable = await ensureEditable();
    if (!editable) return;
    setData((d: AnamnesiRow | null) => {
      const target = d && d.id === editable.id ? d : editable;
      return { ...target, note_libere: v };
    });
  }

  async function firmaAnamnesi(firmaPazienteDataUrl: string, firmaMedicoDataUrl: string | null) {
    if (!data) return;
    if (data.stato === "signed") return;
    setSigning(true);
    try {
      const [pazRes, profRes] = await Promise.all([
        supabase
          .from("pazienti")
          .select("nome, cognome, codice_fiscale, data_nascita")
          .eq("id", pazienteId)
          .single(),
        user?.id
          ? supabase.from("profiles").select("nome, cognome").eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null, error: null } as const),
      ]);
      if (pazRes.error || !pazRes.data) {
        throw new Error(pazRes.error?.message ?? "Paziente non trovato");
      }
      const operatoreNome = profRes.data
        ? `${profRes.data.cognome ?? ""} ${profRes.data.nome ?? ""}`.trim() || null
        : null;

      const firmataIl = new Date();

      const { blob, hash } = await generaPdfAnamnesi({
        paziente: {
          nome: pazRes.data.nome,
          cognome: pazRes.data.cognome,
          codice_fiscale: pazRes.data.codice_fiscale ?? null,
          data_nascita: pazRes.data.data_nascita ?? null,
        },
        versioneNumero: data.versione_numero ?? 1,
        firmataIl,
        payload: {
          generale: (data.generale ?? {}) as Record<string, unknown>,
          patologica: (data.patologica ?? {}) as Record<string, unknown>,
          farmacologica: (data.farmacologica ?? {}) as Record<string, unknown>,
          estetica: (data.estetica ?? {}) as Record<string, unknown>,
          note_libere: data.note_libere,
        },
        firmaPazienteDataUrl,
        firmaMedicoDataUrl,
        operatoreNome,
      });

      const path = `${pazienteId}/${data.id}-v${data.versione_numero}.pdf`;
      const up = await supabase.storage
        .from("anamnesi-pdf")
        .upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (up.error || !up.data?.path) {
        console.error("[anamnesi-pdf upload] errore", up.error, "path:", path);
        throw new Error(`Upload PDF anamnesi fallito: ${up.error?.message ?? "path vuoto"}`);
      }

      const { error: updErr } = await supabase
        .from("anamnesi")
        .update({
          stato: "signed",
          firmata_il: firmataIl.toISOString(),
          firmata_da_medico: user?.id ?? null,
          firma_paziente: firmaPazienteDataUrl,
          firma_medico: firmaMedicoDataUrl,
          hash_integrita: hash,
          pdf_url: path,
        })
        .eq("id", data.id);
      if (updErr) throw updErr;

      toast.success("Anamnesi firmata e bloccata");
      setSignDlgOpen(false);
      await load();
      onSaved();
    } catch (e) {
      toast.error(`Errore firma: ${(e as Error).message}`);
    } finally {
      setSigning(false);
    }
  }

  async function save() {
    if (!data) return;
    if (data.stato === "signed") {
      toast.error(
        "Anamnesi firmata: modifica un campo per creare automaticamente una nuova versione",
      );
      return;
    }
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

    toast.success("Bozza salvata");
    setSaving(false);
    onSaved();
  }

  function openSignDialog() {
    if (!data) return;
    if (data.stato === "signed") {
      toast.info("Già firmata. Modifica un campo per creare una nuova versione.");
      return;
    }
    setSignDlgOpen(true);
  }

  function confermaFirma() {
    const padPaz = sigPazRef.current;
    if (!padPaz || padPaz.isEmpty()) {
      toast.error("La firma del paziente è obbligatoria");
      return;
    }
    const firmaPaz = padPaz.toDataURL();
    const padMed = sigMedRef.current;
    const firmaMed = padMed && !padMed.isEmpty() ? padMed.toDataURL() : null;
    void firmaAnamnesi(firmaPaz, firmaMed);
  }

  /** Stampa anamnesi senza firme per workflow cartaceo. */
  async function stampaAnamnesi() {
    if (!data) return;
    try {
      const { data: paz, error: pazErr } = await supabase
        .from("pazienti")
        .select("nome, cognome, codice_fiscale, data_nascita")
        .eq("id", pazienteId)
        .single();
      if (pazErr || !paz) throw new Error(pazErr?.message ?? "Paziente non trovato");
      const { blob } = await generaPdfAnamnesi({
        paziente: {
          nome: paz.nome,
          cognome: paz.cognome,
          codice_fiscale: paz.codice_fiscale ?? null,
          data_nascita: paz.data_nascita ?? null,
        },
        versioneNumero: data.versione_numero ?? 1,
        firmataIl: new Date(),
        payload: {
          generale: (data.generale ?? {}) as Record<string, unknown>,
          patologica: (data.patologica ?? {}) as Record<string, unknown>,
          farmacologica: (data.farmacologica ?? {}) as Record<string, unknown>,
          estetica: (data.estetica ?? {}) as Record<string, unknown>,
          note_libere: data.note_libere,
        },
        firmaPazienteDataUrl: null,
        firmaMedicoDataUrl: null,
        operatoreNome: null,
        modalita: "cartaceo",
      });
      setDraftPdfBlob(blob);
      setDraftPdfOpen(true);
    } catch (e) {
      toast.error(`Errore stampa: ${(e as Error).message}`);
    }
  }

  /** Carica PDF cartaceo già firmato. */
  async function caricaCartaceo(file: File, dataFirma: string): Promise<boolean> {
    if (!data) return false;
    if (data.stato === "signed") {
      toast.error("Già firmata. Modifica un campo per creare una nuova versione.");
      return false;
    }
    setSigning(true);
    try {
      const firmataIl = new Date(`${dataFirma}T12:00:00`);
      if (isNaN(firmataIl.getTime()) || firmataIl > new Date()) {
        throw new Error("Data firma non valida");
      }
      const path = `${pazienteId}/${data.id}-v${data.versione_numero}-cartaceo.pdf`;
      const up = await supabase.storage
        .from("anamnesi-pdf")
        .upload(path, file, { contentType: file.type || "application/pdf", upsert: true });
      if (up.error || !up.data?.path) {
        console.error("[anamnesi-pdf cartaceo] upload errore", up.error);
        throw new Error(`Upload PDF fallito: ${up.error?.message ?? "path vuoto"}`);
      }
      const enc = new TextEncoder().encode(
        `cartaceo|${file.name}|${file.size}|${firmataIl.toISOString()}`,
      );
      const buf = await crypto.subtle.digest("SHA-256", enc);
      const hash = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const { error: updErr } = await supabase
        .from("anamnesi")
        .update({
          stato: "signed",
          firmata_il: firmataIl.toISOString(),
          firmata_da_medico: user?.id ?? null,
          firma_paziente: null,
          firma_medico: null,
          hash_integrita: hash,
          pdf_url: path,
        })
        .eq("id", data.id);
      if (updErr) throw updErr;
      toast.success("Anamnesi cartacea archiviata");
      setCartaceoDlgOpen(false);
      await load();
      onSaved();
      return true;
    } catch (e) {
      toast.error(`Errore: ${(e as Error).message}`);
      return false;
    } finally {
      setSigning(false);
    }
  }

  function isCartaceo(row: AnamnesiRow): boolean {
    return row.stato === "signed" && !row.firma_paziente && !!row.pdf_url;
  }

  if (loading || !data) {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  }

  const g = data.generale ?? {};
  const p = data.patologica ?? {};
  const fa = data.farmacologica ?? {};
  const es = data.estetica ?? {};

  const isSigned = data.stato === "signed";

  return (
    <div className="space-y-4">
      {/* === Stato firma === */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 p-3 text-sm ${
          isSigned ? "border-success/40 bg-success/10" : "border-warning/40 bg-warning/10"
        }`}
      >
        <div className="flex items-center gap-2">
          {isSigned ? (
            <Lock className="h-4 w-4 text-success" />
          ) : (
            <FileSignature className="h-4 w-4 text-warning" />
          )}
          <span>
            {isSigned
              ? `Firmata v${data.versione_numero}${data.firmata_il ? ` il ${new Date(data.firmata_il).toLocaleString("it-IT")}` : ""}${isCartaceo(data) ? " · cartacea" : ""} — modifica un campo per creare una nuova versione`
              : `Bozza v${data.versione_numero ?? 1} — richiede firma del paziente`}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isSigned && (
            <>
              <Button size="sm" variant="outline" onClick={() => void stampaAnamnesi()}>
                <Printer className="h-4 w-4" />
                Stampa bozza
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCartaceoDlgOpen(true)}
                disabled={signing || forking}
              >
                <Upload className="h-4 w-4" />
                Carica PDF firmato
              </Button>
              {lastSigned && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void annullaModifiche()}
                  disabled={annullando || signing || forking}
                  className="text-destructive"
                >
                  {annullando ? "Annullamento…" : `Annulla modifiche (torna a v${lastSigned.versione_numero})`}
                </Button>
              )}
              <Button size="sm" onClick={openSignDialog} disabled={signing || forking}>
                <FileSignature className="h-4 w-4" />
                {signing ? "Firma in corso…" : "Firma e blocca"}
              </Button>
            </>
          )}
        </div>
      </div>
      {isSigned && data.pdf_url && (
        <PdfSignedLink
          bucket="anamnesi-pdf"
          path={data.pdf_url}
          label={isCartaceo(data) ? "Apri PDF cartaceo firmato" : "Apri PDF anamnesi firmata"}
        />
      )}
      {isSigned && !data.pdf_url && (
        <p className="text-xs text-muted-foreground">
          PDF non disponibile (versione anteriore alla generazione automatica)
        </p>
      )}
      {forking && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <History className="h-3 w-3" /> Creazione nuova versione in corso…
        </p>
      )}

      {/* Dialog upload cartaceo */}
      <CartaceoUploadDialog
        open={cartaceoDlgOpen}
        onClose={() => setCartaceoDlgOpen(false)}
        onConfirm={(file, dataFirma) => caricaCartaceo(file, dataFirma)}
        saving={signing}
      />

      <PdfBlobDialog
        open={draftPdfOpen}
        onOpenChange={(open) => {
          setDraftPdfOpen(open);
          if (!open) setDraftPdfBlob(null);
        }}
        blob={draftPdfBlob}
        title="Bozza anamnesi"
        filename="bozza-anamnesi.pdf"
      />

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
                      v === "_none" ? "" : (v as "sana" | "abbastanza" | "disequilibrata"),
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
                      checked={!!(p as Record<string, unknown>)[pat.k]}
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
                      checked={!!(fa as Record<string, unknown>)[t.k]}
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
                    fototipo: v === "_none" ? "" : (v as "I" | "II" | "III" | "IV" | "V" | "VI"),
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
                    texture: v === "_none" ? "" : (v as "omogenea" | "parziale" | "disomogenea"),
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
            onChange={(e) => void setNoteLibere(e.target.value)}
            placeholder="Annotazioni anamnestiche aggiuntive…"
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button onClick={save} disabled={saving || isSigned} variant="outline">
          {saving
            ? "Salvataggio…"
            : isSigned
              ? "Firmata (modifica per nuova versione)"
              : "Salva bozza"}
        </Button>
        {!isSigned && (
          <Button onClick={openSignDialog} disabled={signing || forking}>
            <FileSignature className="h-4 w-4" />
            {signing ? "Firma…" : "Firma e blocca"}
          </Button>
        )}
      </div>

      {/* Dialog firma */}
      <Dialog open={signDlgOpen} onOpenChange={setSignDlgOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              Firma anamnesi v{data.versione_numero}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <React.Suspense
              fallback={<p className="text-sm text-muted-foreground">Caricamento area firma…</p>}
            >
              <div>
                <p className="mb-2 text-sm font-medium">Firma del paziente *</p>
                <SignaturePad ref={sigPazRef} />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">
                  Firma del medico <span className="text-muted-foreground">(opzionale)</span>
                </p>
                <SignaturePad ref={sigMedRef} />
              </div>
            </React.Suspense>
            <p className="text-xs text-muted-foreground">
              Firmando, il paziente conferma la veridicità delle informazioni. Il record diventerà
              immutabile; modifiche future creeranno una nuova versione.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignDlgOpen(false)} disabled={signing}>
              Annulla
            </Button>
            <Button onClick={confermaFirma} disabled={signing}>
              <FileSignature className="h-4 w-4" />
              {signing ? "Firma in corso…" : "Conferma e blocca"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function CartaceoUploadDialog({
  open,
  onClose,
  onConfirm,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (file: File, dataFirma: string) => Promise<boolean>;
  saving: boolean;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [dataFirma, setDataFirma] = React.useState<string>(new Date().toISOString().slice(0, 10));
  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setDataFirma(new Date().toISOString().slice(0, 10));
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Carica anamnesi cartacea firmata</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm font-medium">PDF firmato *</p>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
            />
            {file && (
              <p className="mt-1 text-xs text-muted-foreground">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Data firma *</p>
            <input
              type="date"
              value={dataFirma}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDataFirma(e.target.value)}
              className="block w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annulla
          </Button>
          <Button
            onClick={() => file && void onConfirm(file, dataFirma)}
            disabled={!file || !dataFirma || saving}
          >
            {saving ? "Caricamento…" : "Conferma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
