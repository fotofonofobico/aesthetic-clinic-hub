import { useEffect, useRef, useState } from "react";
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
import { SendToTabletButton } from "@/components/firma/send-to-tablet-button";

interface Props {
  open: boolean;
  session: SignatureSession | null;
  pazienteNome?: string;
  onClose: () => void;
  onCompleted: () => void;
}

type Stato = "compilazione" | "salvataggio" | "fatto";
type Phase = "consensi" | "anamnesi" | "trattamento";

type Scelta = "acconsento" | "non_acconsento";

export function SignatureSessionDialog({ open, session, pazienteNome = "", onClose, onCompleted }: Props) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<SessionDoc[]>([]);
  const [stato, setStato] = useState<Stato>("compilazione");

  // Indici dei doc consensi (gdpr/uso_immagini), del doc anamnesi e dei doc trattamento
  const consensoIdxs = docs
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.kind.kind === "gdpr" || d.kind.kind === "uso_immagini")
    .map(({ i }) => i);
  const anamnesiIdx = docs.findIndex((d) => d.kind.kind === "anamnesi");
  const trattamentoIdxs = docs
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.kind.kind === "trattamento")
    .map(({ i }) => i);

  // Per la sessione "visita": phase iniziale = consensi se ne esistono, altrimenti anamnesi
  // Per "trattamento": resta documento-per-documento
  const isVisita = session?.tipo === "visita";

  const [phase, setPhase] = useState<Phase>("consensi");
  const [trattamentoStep, setTrattamentoStep] = useState(0);

  // STATE FASE CONSENSI (combinata)
  const [scelteConsensi, setScelteConsensi] = useState<Record<string, Scelta | undefined>>({});
  const sigConsensiRef = useRef<SignaturePadHandle>(null);
  const [firmaConsensiReady, setFirmaConsensiReady] = useState(false);

  // STATE FASE ANAMNESI / TRATTAMENTO singolo
  const [sceltaSingolo, setSceltaSingolo] = useState<Scelta | undefined>();
  const sigSingoloRef = useRef<SignaturePadHandle>(null);
  const sigSingoloMedRef = useRef<SignaturePadHandle>(null);
  const [firmaSingoloReady, setFirmaSingoloReady] = useState(false);
  const [firmaSingoloMedReady, setFirmaSingoloMedReady] = useState(false);

  // Reset al cambio sessione
  useEffect(() => {
    if (!session) return;
    setDocs(session.documenti.map((d) => ({ ...d })));
    setStato("compilazione");
    setScelteConsensi({});
    setSceltaSingolo(undefined);
    setFirmaConsensiReady(false);
    setFirmaSingoloReady(false);
    setFirmaSingoloMedReady(false);
    setTrattamentoStep(0);
    sigConsensiRef.current?.clear();
    sigSingoloRef.current?.clear();
    sigSingoloMedRef.current?.clear();

    // Phase iniziale
    if (session.tipo === "visita") {
      const hasConsensi = session.documenti.some(
        (d) => d.kind.kind === "gdpr" || d.kind.kind === "uso_immagini",
      );
      setPhase(hasConsensi ? "consensi" : "anamnesi");
    } else {
      setPhase("trattamento");
    }
  }, [session]);

  function chiudi() {
    if (stato === "salvataggio") return;
    onClose();
  }

  // ===== FASE CONSENSI (combinata GDPR + uso immagini) =====
  function confermaConsensi() {
    if (consensoIdxs.length === 0) {
      // niente da firmare in questa fase, salta direttamente
      goToAfterConsensi();
      return;
    }
    // Verifica scelte
    for (const i of consensoIdxs) {
      const d = docs[i];
      if (!scelteConsensi[d.localId]) {
        toast.error(`Seleziona "Acconsento" o "Non acconsento" per ${d.titolo}`);
        return;
      }
    }
    // Vincolo: GDPR rifiutato = blocca
    const gdprIdx = consensoIdxs.find((i) => docs[i].kind.kind === "gdpr");
    if (gdprIdx !== undefined && scelteConsensi[docs[gdprIdx].localId] === "non_acconsento") {
      toast.error(
        "Il consenso GDPR/Privacy è obbligatorio per proseguire la visita. Non è possibile rifiutarlo.",
      );
      return;
    }
    // Firma unica obbligatoria
    const pad = sigConsensiRef.current;
    if (!pad || pad.isEmpty()) {
      toast.error("La firma del paziente è obbligatoria");
      return;
    }
    const firma = pad.toDataURL();

    // Applica la firma e la scelta a TUTTI i doc consensi
    const next = [...docs];
    for (const i of consensoIdxs) {
      const d = next[i];
      next[i] = {
        ...d,
        scelta: scelteConsensi[d.localId],
        firmaPaziente: firma,
        firmaMedico: null,
        completato: true,
      };
    }
    setDocs(next);
    goToAfterConsensi(next);
  }

  function goToAfterConsensi(currentDocs?: SessionDoc[]) {
    const hasAnamnesi = (currentDocs ?? docs).some((d) => d.kind.kind === "anamnesi");
    if (hasAnamnesi) {
      setPhase("anamnesi");
      // reset firma anamnesi
      setSceltaSingolo(undefined);
      setFirmaSingoloReady(false);
      setFirmaSingoloMedReady(false);
      sigSingoloRef.current?.clear();
      sigSingoloMedRef.current?.clear();
    } else {
      void salvaTutto(currentDocs ?? docs);
    }
  }

  // ===== FASE ANAMNESI =====
  function confermaAnamnesi() {
    if (anamnesiIdx < 0) {
      void salvaTutto(docs);
      return;
    }
    if (!sceltaSingolo) {
      toast.error("Seleziona Acconsento o Non acconsento");
      return;
    }
    const pad = sigSingoloRef.current;
    if (!pad || pad.isEmpty()) {
      toast.error("La firma del paziente è obbligatoria");
      return;
    }
    const firma = pad.toDataURL();
    let firmaMed: string | null = null;
    if (docs[anamnesiIdx].richiedeFirmaMedico) {
      const padMed = sigSingoloMedRef.current;
      if (!padMed || padMed.isEmpty()) {
        toast.error("La firma del medico è obbligatoria per questo documento");
        return;
      }
      firmaMed = padMed.toDataURL();
    }
    const next = [...docs];
    next[anamnesiIdx] = {
      ...next[anamnesiIdx],
      scelta: sceltaSingolo,
      firmaPaziente: firma,
      firmaMedico: firmaMed,
      completato: true,
    };
    setDocs(next);
    void salvaTutto(next);
  }

  function tornaAiConsensi() {
    setPhase("consensi");
  }

  // ===== FASE TRATTAMENTO (documento-per-documento, retro-compatibile) =====
  const currentTratt = trattamentoIdxs[trattamentoStep];
  function confermaTrattamento() {
    if (currentTratt === undefined) return;
    const doc = docs[currentTratt];
    if (!sceltaSingolo) {
      toast.error("Seleziona Acconsento o Non acconsento");
      return;
    }
    const pad = sigSingoloRef.current;
    if (!pad || pad.isEmpty()) {
      toast.error("La firma del paziente è obbligatoria");
      return;
    }
    const firma = pad.toDataURL();
    let firmaMed: string | null = null;
    if (doc.richiedeFirmaMedico) {
      const padMed = sigSingoloMedRef.current;
      if (!padMed || padMed.isEmpty()) {
        toast.error("La firma del medico è obbligatoria per questo documento");
        return;
      }
      firmaMed = padMed.toDataURL();
    }
    const next = [...docs];
    next[currentTratt] = {
      ...doc,
      scelta: sceltaSingolo,
      firmaPaziente: firma,
      firmaMedico: firmaMed,
      completato: true,
    };
    setDocs(next);
    if (trattamentoStep + 1 < trattamentoIdxs.length) {
      setTrattamentoStep(trattamentoStep + 1);
      setSceltaSingolo(undefined);
      setFirmaSingoloReady(false);
      setFirmaSingoloMedReady(false);
      sigSingoloRef.current?.clear();
      sigSingoloMedRef.current?.clear();
    } else {
      void salvaTutto(next);
    }
  }

  // ===== SALVATAGGIO =====
  async function salvaTutto(finalDocs: SessionDoc[]) {
    if (!session) return;
    setStato("salvataggio");

    const { data: paz, error: pazErr } = await supabase
      .from("pazienti")
      .select("nome, cognome, data_nascita, codice_fiscale")
      .eq("id", session.pazienteId)
      .single();
    if (pazErr || !paz) {
      toast.error("Errore caricamento paziente");
      setStato("compilazione");
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

    const insertedConsensi: string[] = [];
    const uploadedPaths: string[] = [];

    try {
      const firmatoIl = new Date();

      for (const doc of finalDocs) {
        if (!doc.completato) continue; // safety

        if (doc.kind.kind === "anamnesi") {
          if (doc.scelta === "non_acconsento") continue;
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
            },
            firmaPazienteDataUrl: doc.firmaPaziente,
            firmaMedicoDataUrl: doc.firmaMedico ?? null,
            operatoreNome,
          });

          const path = `${session.pazienteId}/${doc.kind.anamnesiId}-v${doc.kind.versioneNumero}.pdf`;
          const up = await supabase.storage
            .from("anamnesi-pdf")
            .upload(path, blob, { contentType: "application/pdf", upsert: true });
          if (up.error || !up.data?.path) {
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
          const categoria = doc.kind.kind === "trattamento" ? doc.kind.categoria : doc.kind.kind;
          const validoFinoA =
            doc.scelta === "acconsento" ? calcolaValidoFinoA(doc, firmatoIl) : null;

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
            throw new Error(`Upload PDF consenso fallito: ${up.error?.message ?? "path vuoto"}`);
          }
          uploadedPaths.push(`consensi-pdf:${pdfPath}`);

          const integrita = await sha256Hex(
            `${doc.titolo}|${doc.testo}|${doc.versione}|${firmatoIl.toISOString()}|${
              doc.firmaPaziente?.length ?? 0
            }|${doc.scelta}|${hash}`,
          );

          const insertPayload: Record<string, unknown> = {
            paziente_id: session.pazienteId,
            template_id: doc.kind.templateId,
            titolo_snapshot: doc.titolo,
            testo_snapshot: doc.testo,
            versione_snapshot: doc.versione,
            categoria_snapshot: categoria,
            validita_mesi_snapshot: doc.validitaMesi,
            durata_tipo_snapshot: doc.durataTipo,
            durata_sedute_snapshot: doc.duratSedute,
            sedute_max_snapshot:
              doc.durataTipo === "sedute" ? doc.duratSedute : null,
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
      if (insertedConsensi.length > 0) {
        await supabase.from("consenso_firmato").delete().in("id", insertedConsensi);
      }
      for (const p of uploadedPaths) {
        const [bucket, ...rest] = p.split(":");
        const path = rest.join(":");
        await supabase.storage.from(bucket).remove([path]);
      }
      toast.error(`Errore salvataggio: ${(e as Error).message}`);
      setStato("compilazione");
    }
  }

  if (!session) return null;

  // Progress
  const totalPhases = isVisita
    ? (consensoIdxs.length > 0 ? 1 : 0) + (anamnesiIdx >= 0 ? 1 : 0)
    : trattamentoIdxs.length;
  const currentPhaseNum = (() => {
    if (!isVisita) return trattamentoStep + 1;
    if (phase === "consensi") return 1;
    return (consensoIdxs.length > 0 ? 1 : 0) + 1;
  })();
  const progressValue = totalPhases > 0 ? (currentPhaseNum / totalPhases) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && chiudi()}>
      <DialogContent className="max-h-[95vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <FileSignature className="h-5 w-5" />
            {isVisita ? "Sessione firma — Visita" : "Sessione firma — Trattamento"}
          </DialogTitle>
          {totalPhases > 0 && stato !== "fatto" && (
            <p className="text-xs text-muted-foreground">
              {isVisita
                ? phase === "consensi"
                  ? "Step 1 — Consensi (GDPR + Uso immagini)"
                  : "Step 2 — Anamnesi"
                : `Documento ${trattamentoStep + 1} di ${trattamentoIdxs.length}`}
            </p>
          )}
        </DialogHeader>

        {docs.length === 0 && (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
            <p className="mt-3 text-sm">Nessun documento da firmare. Tutto in regola.</p>
          </div>
        )}

        {docs.length > 0 && stato === "compilazione" && (
          <div className="space-y-4">
            <Progress value={progressValue} />

            {/* === FASE CONSENSI COMBINATI === */}
            {isVisita && phase === "consensi" && consensoIdxs.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Una sola firma vale per entrambi i consensi. Le scelte (Acconsento / Non
                  acconsento) sono indipendenti.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {consensoIdxs.map((i) => {
                    const d = docs[i];
                    return (
                      <div
                        key={d.localId}
                        className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3"
                      >
                        <div>
                          <div className="flex flex-wrap items-baseline gap-2">
                            <h3 className="font-display text-base font-semibold">{d.titolo}</h3>
                            <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              v{d.versione}
                            </span>
                          </div>
                          <div className="mt-2 max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-2 text-xs">
                            <p className="whitespace-pre-wrap">{d.testo}</p>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-semibold">Scelta paziente *</Label>
                          <RadioGroup
                            value={scelteConsensi[d.localId] ?? ""}
                            onValueChange={(v) =>
                              setScelteConsensi((prev) => ({
                                ...prev,
                                [d.localId]: v as Scelta,
                              }))
                            }
                            className="grid gap-1.5"
                          >
                            <label
                              htmlFor={`acc-${d.localId}`}
                              className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 hover:bg-accent/30"
                            >
                              <RadioGroupItem value="acconsento" id={`acc-${d.localId}`} />
                              <span className="text-sm leading-none">Acconsento</span>
                            </label>
                            <label
                              htmlFor={`nacc-${d.localId}`}
                              className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-1.5 hover:bg-accent/30"
                            >
                              <RadioGroupItem value="non_acconsento" id={`nacc-${d.localId}`} />
                              <span className="text-sm leading-none">Non acconsento</span>
                            </label>
                          </RadioGroup>
                          {d.kind.kind === "gdpr" &&
                            scelteConsensi[d.localId] === "non_acconsento" && (
                              <p className="text-[11px] text-destructive">
                                Il GDPR è obbligatorio per proseguire la visita.
                              </p>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <Label className="text-sm font-semibold">
                    Firma del paziente * — vale per entrambi i consensi
                  </Label>
                  <SignaturePad
                    ref={sigConsensiRef}
                    onChange={(empty) => setFirmaConsensiReady(!empty)}
                  />
                  <OppureInviaTablet
                    session={session}
                    pazienteNome={pazienteNome}
                    onSent={onClose}
                    onCompleted={onCompleted}
                  />
                </div>
              </div>
            )}

            {/* === FASE ANAMNESI === */}
            {isVisita && phase === "anamnesi" && anamnesiIdx >= 0 && (
              <div className="space-y-4">
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="font-display text-lg font-semibold">
                      {docs[anamnesiIdx].titolo}
                    </h3>
                    <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      v{docs[anamnesiIdx].versione}
                    </span>
                  </div>
                  <div className="mt-2 max-h-56 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-sm">
                    <p className="whitespace-pre-wrap">{docs[anamnesiIdx].testo}</p>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                  <Label className="text-sm font-semibold">Scelta paziente *</Label>
                  <RadioGroup
                    value={sceltaSingolo ?? ""}
                    onValueChange={(v) => setSceltaSingolo(v as Scelta)}
                    className="grid gap-2"
                  >
                    <label
                      htmlFor="anam-acc"
                      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-accent/30"
                    >
                      <RadioGroupItem value="acconsento" id="anam-acc" />
                      <span className="text-sm leading-none">Acconsento e confermo</span>
                    </label>
                    <label
                      htmlFor="anam-nacc"
                      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-accent/30"
                    >
                      <RadioGroupItem value="non_acconsento" id="anam-nacc" />
                      <span className="text-sm leading-none">Non confermo</span>
                    </label>
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-sm font-semibold">Firma del paziente *</Label>
                  <SignaturePad
                    ref={sigSingoloRef}
                    onChange={(empty) => setFirmaSingoloReady(!empty)}
                  />
                  <OppureInviaTablet
                    session={session}
                    pazienteNome={pazienteNome}
                    onSent={onClose}
                    onCompleted={onCompleted}
                  />
                </div>
                {docs[anamnesiIdx].richiedeFirmaMedico && (
                  <div>
                    <Label className="text-sm font-semibold">Firma del medico *</Label>
                    <SignaturePad
                      ref={sigSingoloMedRef}
                      onChange={(empty) => setFirmaSingoloMedReady(!empty)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* === FASE TRATTAMENTO (legacy doc-per-doc) === */}
            {!isVisita && currentTratt !== undefined && (
              <div className="space-y-4">
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="font-display text-lg font-semibold">
                      {docs[currentTratt].titolo}
                    </h3>
                    <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      v{docs[currentTratt].versione}
                    </span>
                  </div>
                  <div className="mt-2 max-h-56 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-sm">
                    <p className="whitespace-pre-wrap">{docs[currentTratt].testo}</p>
                  </div>
                </div>
                <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                  <Label className="text-sm font-semibold">Scelta paziente *</Label>
                  <RadioGroup
                    value={sceltaSingolo ?? ""}
                    onValueChange={(v) => setSceltaSingolo(v as Scelta)}
                    className="grid gap-2"
                  >
                    <label
                      htmlFor={`tratt-acc-${docs[currentTratt].localId}`}
                      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-accent/30"
                    >
                      <RadioGroupItem
                        value="acconsento"
                        id={`tratt-acc-${docs[currentTratt].localId}`}
                      />
                      <span className="text-sm leading-none">Acconsento</span>
                    </label>
                    <label
                      htmlFor={`tratt-nacc-${docs[currentTratt].localId}`}
                      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 hover:bg-accent/30"
                    >
                      <RadioGroupItem
                        value="non_acconsento"
                        id={`tratt-nacc-${docs[currentTratt].localId}`}
                      />
                      <span className="text-sm leading-none">Non acconsento</span>
                    </label>
                  </RadioGroup>
                </div>
                <div>
                  <Label className="text-sm font-semibold">Firma del paziente *</Label>
                  <SignaturePad
                    ref={sigSingoloRef}
                    onChange={(empty) => setFirmaSingoloReady(!empty)}
                  />
                  <OppureInviaTablet
                    session={session}
                    pazienteNome={pazienteNome}
                    onSent={onClose}
                    onCompleted={onCompleted}
                  />
                </div>
                {docs[currentTratt].richiedeFirmaMedico && (
                  <div>
                    <Label className="text-sm font-semibold">Firma del medico *</Label>
                    <SignaturePad
                      ref={sigSingoloMedRef}
                      onChange={(empty) => setFirmaSingoloMedReady(!empty)}
                    />
                  </div>
                )}
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
          {stato === "compilazione" && isVisita && phase === "anamnesi" && consensoIdxs.length > 0 && (
            <Button variant="ghost" onClick={tornaAiConsensi}>
              <ChevronLeft className="h-4 w-4" />
              Indietro
            </Button>
          )}
          {stato === "compilazione" && isVisita && phase === "consensi" && (
            <Button
              onClick={confermaConsensi}
              disabled={
                !firmaConsensiReady ||
                consensoIdxs.some((i) => !scelteConsensi[docs[i].localId])
              }
            >
              {anamnesiIdx >= 0 ? "Conferma e prosegui" : "Completa e salva"}
            </Button>
          )}
          {stato === "compilazione" && isVisita && phase === "anamnesi" && (
            <Button
              onClick={confermaAnamnesi}
              disabled={
                !sceltaSingolo ||
                !firmaSingoloReady ||
                (docs[anamnesiIdx]?.richiedeFirmaMedico && !firmaSingoloMedReady)
              }
            >
              Completa e salva
            </Button>
          )}
          {stato === "compilazione" && !isVisita && currentTratt !== undefined && (
            <Button
              onClick={confermaTrattamento}
              disabled={
                !sceltaSingolo ||
                !firmaSingoloReady ||
                (docs[currentTratt].richiedeFirmaMedico && !firmaSingoloMedReady)
              }
            >
              {trattamentoStep + 1 < trattamentoIdxs.length
                ? "Conferma e prosegui"
                : "Completa e salva"}
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

/**
 * Bottone alternativo posizionato sotto ogni SignaturePad: permette di
 * delegare la firma a un dispositivo tablet in "modalità firma".
 * Quando la sessione tablet è stata creata con successo, chiude il dialog
 * locale (onSent) per evitare due flussi sovrapposti; il completamento
 * avviene poi tramite il MedicoFinalizeDialog interno a SendToTabletButton.
 */
function OppureInviaTablet({
  session,
  pazienteNome,
  onSent,
  onCompleted,
}: {
  session: SignatureSession | null;
  pazienteNome: string;
  onSent: () => void;
  onCompleted: () => void;
}) {
  if (!session) return null;
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        oppure
      </span>
      <SendToTabletButton
        session={session}
        pazienteNome={pazienteNome || "Paziente"}
        label="Invia a tablet"
        size="sm"
        buildSession={async () => session}
        onSent={onSent}
        onCompleted={onCompleted}
      />
    </div>
  );
}
