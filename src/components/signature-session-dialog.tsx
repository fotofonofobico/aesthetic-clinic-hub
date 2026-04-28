import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { sha256Hex } from "@/lib/hash";
import { generaPdfConsenso } from "@/lib/pdf-consenso";
import { generaPdfAnamnesi } from "@/lib/pdf-anamnesi";
import {
  calcolaValidoFinoA,
  type SessionDoc,
  type SignatureSession,
} from "@/lib/signature-session";
import { CheckCircle2, ChevronLeft, FileSignature, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  session: SignatureSession | null;
  onClose: () => void;
  onCompleted: () => void;
}

type Stato = "scelta_firma" | "salvataggio" | "fatto";

export function SignatureSessionDialog({ open, session, onClose, onCompleted }: Props) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<SessionDoc[]>([]);
  const [step, setStep] = useState(0);
  const [stato, setStato] = useState<Stato>("scelta_firma");
  const [scelta, setScelta] = useState<"acconsento" | "non_acconsento" | undefined>();
  const [firmaReady, setFirmaReady] = useState(false);
  const [firmaMedReady, setFirmaMedReady] = useState(false);
  const sigPazRef = useRef<SignaturePadHandle>(null);
  const sigMedRef = useRef<SignaturePadHandle>(null);

  // Reset al cambio sessione
  useMemo(() => {
    if (session) {
      setDocs(session.documenti.map((d) => ({ ...d })));
      setStep(0);
      setStato("scelta_firma");
      setScelta(undefined);
      setFirmaReady(false);
      setFirmaMedReady(false);
    }
  }, [session]);

  const current = docs[step];
  const total = docs.length;

  function resetStep() {
    setScelta(undefined);
    setFirmaReady(false);
    setFirmaMedReady(false);
    sigPazRef.current?.clear();
    sigMedRef.current?.clear();
  }

  function chiudi() {
    if (stato === "salvataggio") return;
    onClose();
  }

  function confermaDocumento() {
    if (!current) return;
    if (!scelta) {
      toast.error("Seleziona Acconsento o Non acconsento");
      return;
    }
    // Firma del paziente SEMPRE obbligatoria (sia per acconsento sia per non_acconsento)
    let firmaPaz: string | null = null;
    let firmaMed: string | null = null;
    const padPaz = sigPazRef.current;
    if (!padPaz || padPaz.isEmpty()) {
      toast.error("La firma del paziente è obbligatoria");
      return;
    }
    firmaPaz = padPaz.toDataURL();
    // Firma medico richiesta solo se il template lo prevede
    if (current.richiedeFirmaMedico) {
      const padMed = sigMedRef.current;
      if (!padMed || padMed.isEmpty()) {
        toast.error("La firma del medico è obbligatoria per questo documento");
        return;
      }
      firmaMed = padMed.toDataURL();
    }

    const nextDocs = [...docs];
    nextDocs[step] = {
      ...current,
      scelta,
      firmaPaziente: firmaPaz,
      firmaMedico: firmaMed,
      completato: true,
    };
    setDocs(nextDocs);

    if (step + 1 < total) {
      setStep(step + 1);
      resetStep();
    } else {
      void salvaTutto(nextDocs);
    }
  }

  async function salvaTutto(finalDocs: SessionDoc[]) {
    if (!session) return;
    setStato("salvataggio");

    // Carica dati paziente per i PDF
    const { data: paz, error: pazErr } = await supabase
      .from("pazienti")
      .select("nome, cognome, data_nascita, codice_fiscale")
      .eq("id", session.pazienteId)
      .single();
    if (pazErr || !paz) {
      toast.error("Errore caricamento paziente");
      setStato("scelta_firma");
      return;
    }

    let operatoreNome: string | null = null;
    if (user?.id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("nome, cognome")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof) {
        operatoreNome = `${prof.cognome ?? ""} ${prof.nome ?? ""}`.trim() || null;
      }
    }

    // ID delle insert per rollback best-effort
    const insertedConsensi: string[] = [];
    const uploadedPaths: string[] = [];

    try {
      const firmatoIl = new Date();

      for (const doc of finalDocs) {
        if (doc.kind.kind === "anamnesi") {
          // Solo se acconsento: firma + signed
          if (doc.scelta === "non_acconsento") {
            // Anamnesi non firmata: lascia draft, registra rifiuto come nota
            continue;
          }
          if (!doc.firmaPaziente) continue;

          const { blob, hash } = await generaPdfAnamnesi({
            paziente: {
              nome: paz.nome,
              cognome: paz.cognome,
              codice_fiscale: paz.codice_fiscale ?? null,
              data_nascita: paz.data_nascita ?? null,
            },
            versioneNumero: doc.kind.versioneNumero,
            firmataIl: firmatoIl,
            payload: {
              generale: null,
              patologica: null,
              farmacologica: null,
              estetica: null,
              note_libere: null,
            }, // payload reale è già nel record DB; il PDF qui è leggero (i dati clinici restano nella tabella)
            firmaPazienteDataUrl: doc.firmaPaziente,
            firmaMedicoDataUrl: doc.firmaMedico ?? null,
            operatoreNome,
          });

          const path = `${session.pazienteId}/${doc.kind.anamnesiId}-v${doc.kind.versioneNumero}.pdf`;
          const up = await supabase.storage
            .from("anamnesi-pdf")
            .upload(path, blob, { contentType: "application/pdf", upsert: true });
          if (up.error || !up.data?.path) {
            console.error("[anamnesi-pdf upload] errore", up.error, "path:", path);
            throw new Error(`Upload PDF anamnesi fallito: ${up.error?.message ?? "path vuoto"}`);
          }
          uploadedPaths.push(`anamnesi-pdf:${path}`);

          const upd = await supabase
            .from("anamnesi")
            .update({
              stato: "signed",
              firmata_il: firmatoIl.toISOString(),
              firmata_da_medico: user?.id ?? null,
              firma_paziente: doc.firmaPaziente,
              firma_medico: doc.firmaMedico ?? null,
              hash_integrita: hash,
              pdf_url: path,
            })
            .eq("id", doc.kind.anamnesiId);
          if (upd.error) throw upd.error;
        } else {
          // Consenso firmato (gdpr / uso_immagini / trattamento)
          const categoria = doc.kind.kind === "trattamento" ? doc.kind.categoria : doc.kind.kind;
          const validoFinoA =
            doc.scelta === "acconsento" ? calcolaValidoFinoA(doc, firmatoIl) : null;

          // PDF
          const { blob, hash } = await generaPdfConsenso({
            paziente: {
              nome: paz.nome,
              cognome: paz.cognome,
              data_nascita: paz.data_nascita ?? null,
              codice_fiscale: paz.codice_fiscale ?? null,
            },
            titolo: doc.titolo,
            testo: doc.testo,
            versione: doc.versione,
            categoria,
            firmatoIl,
            validoFinoA: validoFinoA ? new Date(validoFinoA) : null,
            modalitaFirma: "tablet",
            firmaPazienteDataUrl: doc.firmaPaziente ?? null,
            firmaMedicoDataUrl: doc.firmaMedico ?? null,
            operatoreNome,
            rifiutato: doc.scelta === "non_acconsento",
            note: null,
          });
          const pdfPath = `${session.pazienteId}/sessione/${Date.now()}-${doc.localId}.pdf`;
          const up = await supabase.storage
            .from("consensi-pdf")
            .upload(pdfPath, blob, { contentType: "application/pdf" });
          if (up.error || !up.data?.path) {
            console.error("[consensi-pdf upload] errore", up.error, "path:", pdfPath);
            throw new Error(`Upload PDF consenso fallito: ${up.error?.message ?? "path vuoto"}`);
          }
          if (!pdfPath) throw new Error("pdf_url vuoto, abort");
          uploadedPaths.push(`consensi-pdf:${pdfPath}`);

          // Hash extra includendo firma + esito (compatibile con l'engine esistente)
          const integrita = await sha256Hex(
            `${doc.titolo}|${doc.testo}|${doc.versione}|${firmatoIl.toISOString()}|${
              doc.firmaPaziente?.length ?? 0
            }|${doc.scelta}|${hash}`,
          );

          const insertPayload: Record<string, unknown> = {
            paziente_id: session.pazienteId,
            template_id:
              doc.kind.kind === "trattamento"
                ? doc.kind.templateId
                : doc.kind.templateId,
            titolo_snapshot: doc.titolo,
            testo_snapshot: doc.testo,
            versione_snapshot: doc.versione,
            categoria_snapshot: categoria,
            validita_mesi_snapshot: doc.validitaMesi,
            modalita_firma: "tablet",
            firma_immagine: doc.firmaPaziente ?? null,
            firma_medico_immagine: doc.firmaMedico ?? null,
            pdf_url: pdfPath,
            firmato_il: firmatoIl.toISOString(),
            valido_fino_a: validoFinoA,
            user_agent: navigator.userAgent,
            operatore_testimone: user?.id ?? null,
            firmato_da_medico: doc.firmaMedico ? user?.id ?? null : null,
            hash_integrita: integrita,
            rifiutato: doc.scelta === "non_acconsento",
            note: null,
          };

          const ins = await supabase
            .from("consenso_firmato")
            .insert(insertPayload as never)
            .select("id")
            .single();
          if (ins.error) throw ins.error;
          if (ins.data?.id) insertedConsensi.push(ins.data.id);
        }
      }

      setStato("fatto");
      toast.success("Sessione firma completata");
      onCompleted();
    } catch (e) {
      // Rollback best effort
      if (insertedConsensi.length > 0) {
        await supabase.from("consenso_firmato").delete().in("id", insertedConsensi);
      }
      for (const p of uploadedPaths) {
        const [bucket, ...rest] = p.split(":");
        const path = rest.join(":");
        await supabase.storage.from(bucket).remove([path]);
      }
      toast.error(`Errore salvataggio: ${(e as Error).message}`);
      setStato("scelta_firma");
    }
  }

  if (!session) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && chiudi()}>
      <DialogContent className="max-h-[95vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            {session.tipo === "visita" ? "Sessione firma — Visita" : "Sessione firma — Trattamento"}
          </DialogTitle>
          {total > 0 && (
            <p className="text-xs text-muted-foreground">
              Documento {Math.min(step + 1, total)} di {total}
            </p>
          )}
        </DialogHeader>

        {total === 0 && (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="mt-3 text-sm">Nessun documento da firmare. Tutto in regola.</p>
          </div>
        )}

        {total > 0 && stato !== "fatto" && current && (
          <div className="space-y-4">
            <Progress value={((step + (stato === "salvataggio" ? 1 : 0)) / total) * 100} />

            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="font-display text-lg font-semibold">{current.titolo}</h3>
                <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  v{current.versione}
                </span>
              </div>
              <div className="mt-2 max-h-56 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p className="whitespace-pre-wrap">{current.testo}</p>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-card p-3">
              <Label className="text-sm font-semibold">Scelta paziente *</Label>
              <RadioGroup
                value={scelta ?? ""}
                onValueChange={(v) => setScelta(v as "acconsento" | "non_acconsento")}
                className="grid gap-2"
              >
                <label
                  htmlFor={`acc-${current.localId}`}
                  className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-accent/30"
                >
                  <RadioGroupItem value="acconsento" id={`acc-${current.localId}`} />
                  <span className="text-sm leading-none">Acconsento</span>
                </label>
                <label
                  htmlFor={`nacc-${current.localId}`}
                  className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-accent/30"
                >
                  <RadioGroupItem value="non_acconsento" id={`nacc-${current.localId}`} />
                  <span className="text-sm leading-none">Non acconsento</span>
                </label>
              </RadioGroup>
            </div>

            {/* Firma sempre richiesta, indipendentemente dalla scelta */}
            <div>
              <Label className="text-sm font-semibold">Firma del paziente *</Label>
              <SignaturePad
                ref={sigPazRef}
                onChange={(empty) => setFirmaReady(!empty)}
              />
            </div>
            {current.richiedeFirmaMedico && (
              <div>
                <Label className="text-sm font-semibold">Firma del medico *</Label>
                <SignaturePad
                  ref={sigMedRef}
                  onChange={(empty) => setFirmaMedReady(!empty)}
                />
              </div>
            )}
          </div>
        )}

        {stato === "fatto" && (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <p className="mt-3 text-sm">Tutti i documenti sono stati salvati.</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {stato === "scelta_firma" && step > 0 && (
            <Button variant="ghost" onClick={() => { setStep(step - 1); resetStep(); }}>
              <ChevronLeft className="h-4 w-4" />
              Indietro
            </Button>
          )}
          {stato === "scelta_firma" && current && (
            <Button
              onClick={confermaDocumento}
              disabled={
                !scelta ||
                !firmaReady ||
                (current.richiedeFirmaMedico && !firmaMedReady)
              }
            >
              {step + 1 < total ? "Conferma e prosegui" : "Completa e salva"}
            </Button>
          )}
          {stato === "salvataggio" && (
            <Button disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvataggio…
            </Button>
          )}
          {stato === "fatto" && <Button onClick={chiudi}>Chiudi</Button>}
          {stato !== "salvataggio" && stato !== "fatto" && (
            <Button variant="outline" onClick={chiudi}>
              Annulla sessione
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
