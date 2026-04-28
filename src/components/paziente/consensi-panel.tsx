import * as React from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  FileSignature,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Upload,
  PenLine,
  FileText,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { sha256Hex } from "@/lib/hash";
import {
  CATEGORIA_LABELS,
  type ConsensoFirmato,
  type ConsensoStato,
  type ConsensoTemplate,
  type ConsensoModalitaFirma,
} from "@/types/trattamenti";
import { STATO_BADGE } from "@/lib/consensi-engine";
import { ShareConsensoButton } from "@/components/share-consenso-button";

type StatoMap = Record<string, ConsensoStato>; // consenso.id -> stato

export function ConsensiPanel({ pazienteId }: { pazienteId: string }) {
  const { user, hasRole } = useAuth();
  const isMedico = hasRole("medico");
  const [firmati, setFirmati] = useState<ConsensoFirmato[]>([]);
  const [stati, setStati] = useState<StatoMap>({});
  const [templates, setTemplates] = useState<ConsensoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDlg, setOpenDlg] = useState(false);
  const [viewing, setViewing] = useState<ConsensoFirmato | null>(null);
  const [pdfUrls, setPdfUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    void load();
  }, [pazienteId]);

  async function load() {
    setLoading(true);
    const [fRes, tRes, sRes] = await Promise.all([
      supabase
        .from("consenso_firmato")
        .select("*")
        .eq("paziente_id", pazienteId)
        .order("firmato_il", { ascending: false }),
      supabase
        .from("consenso_template")
        .select("*")
        .eq("attivo", true)
        .order("titolo"),
      supabase.rpc("paziente_consensi_stato", { _paziente_id: pazienteId }),
    ]);
    const list = (fRes.data ?? []) as unknown as ConsensoFirmato[];
    setFirmati(list);
    setTemplates((tRes.data ?? []) as unknown as ConsensoTemplate[]);
    const map: StatoMap = {};
    for (const r of (sRes.data ?? []) as Array<{
      consenso_id: string;
      stato: ConsensoStato;
    }>) {
      map[r.consenso_id] = r.stato;
    }
    setStati(map);
    setLoading(false);
  }

  async function getSignedUrl(path: string): Promise<string | null> {
    if (pdfUrls[path]) return pdfUrls[path];
    const { data, error } = await supabase.storage
      .from("consensi-pdf")
      .createSignedUrl(path, 60 * 10);
    if (error || !data) return null;
    setPdfUrls((p) => ({ ...p, [path]: data.signedUrl }));
    return data.signedUrl;
  }

  async function revoca(c: ConsensoFirmato) {
    if (!isMedico) return;
    if (!confirm(`Revocare il consenso "${c.titolo_snapshot}"?`)) return;
    const { error } = await supabase
      .from("consenso_firmato")
      .update({ revocato_il: new Date().toISOString(), revocato_da: user?.id })
      .eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Consenso revocato");
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold">Consensi firmati</h3>
          <p className="text-xs text-muted-foreground">
            Archivio storico immutabile. Stato calcolato in tempo reale.
          </p>
        </div>
        <Dialog open={openDlg} onOpenChange={setOpenDlg}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Nuovo consenso
            </Button>
          </DialogTrigger>
          <NuovoConsensoDialog
            pazienteId={pazienteId}
            templates={templates}
            onClose={() => setOpenDlg(false)}
            onSaved={() => {
              setOpenDlg(false);
              void load();
            }}
          />
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : firmati.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <FileSignature className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nessun consenso ancora firmato per questo paziente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {firmati.map((c) => {
            const stato: ConsensoStato = stati[c.id] ?? "valid";
            const badge = STATO_BADGE[stato];
            return (
              <Card
                key={c.id}
                className="cursor-pointer transition-colors hover:bg-accent/30"
                onClick={() => setViewing(c)}
              >
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {stato === "valid" ? (
                        <ShieldCheck className="h-4 w-4 text-success-foreground" />
                      ) : (
                        <ShieldAlert className="h-4 w-4 text-warning" />
                      )}
                      <span className="font-medium">{c.titolo_snapshot}</span>
                      <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        v{c.versione_snapshot}
                      </span>
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary">
                        {CATEGORIA_LABELS[c.categoria_snapshot]}
                      </span>
                      <span
                        className={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      {c.modalita_firma === "pdf_caricato" ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          PDF
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Firmato il{" "}
                      {new Date(c.firmato_il).toLocaleString("it-IT", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      {c.valido_fino_a
                        ? ` · scade ${new Date(c.valido_fino_a).toLocaleDateString("it-IT")}`
                        : ""}
                    </p>
                  </div>
                  {c.modalita_firma === "tablet" && c.firma_immagine ? (
                    <img
                      src={c.firma_immagine}
                      alt="firma"
                      className="h-12 w-32 rounded border border-border bg-card object-contain"
                    />
                  ) : (
                    <div className="flex h-12 w-32 items-center justify-center rounded border border-border bg-muted/50 text-[10px] text-muted-foreground">
                      PDF firmato
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">
                  {viewing.titolo_snapshot}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    v{viewing.versione_snapshot}
                  </span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 uppercase tracking-wide text-primary">
                    {CATEGORIA_LABELS[viewing.categoria_snapshot]}
                  </span>
                  {(() => {
                    const s: ConsensoStato = stati[viewing.id] ?? "valid";
                    const b = STATO_BADGE[s];
                    return (
                      <span
                        className={`rounded-full border px-2 py-0.5 uppercase tracking-wide ${b.cls}`}
                      >
                        {b.label}
                      </span>
                    );
                  })()}
                  <span className="text-muted-foreground">
                    Firmato {new Date(viewing.firmato_il).toLocaleString("it-IT")}
                  </span>
                  {viewing.valido_fino_a && (
                    <span className="text-muted-foreground">
                      · scade {new Date(viewing.valido_fino_a).toLocaleDateString("it-IT")}
                    </span>
                  )}
                </div>

                <div className="max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{viewing.testo_snapshot}</p>
                </div>

                {viewing.modalita_firma === "tablet" && viewing.firma_immagine ? (
                  <div>
                    <Label>Firma</Label>
                    <img
                      src={viewing.firma_immagine}
                      alt="firma paziente"
                      className="mt-1 h-32 w-full rounded border border-border bg-card object-contain"
                    />
                  </div>
                ) : viewing.pdf_url ? (
                  <div>
                    <Label>PDF firmato</Label>
                    <PdfLink
                      path={viewing.pdf_url}
                      getUrl={() => getSignedUrl(viewing.pdf_url!)}
                    />
                  </div>
                ) : null}

                {viewing.note && (
                  <div>
                    <Label>Note</Label>
                    <p className="text-sm">{viewing.note}</p>
                  </div>
                )}
                {viewing.hash_integrita && (
                  <p className="break-all text-[10px] text-muted-foreground">
                    Hash integrità: {viewing.hash_integrita}
                  </p>
                )}

                {!viewing.revocato_il && (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                    <ShareConsensoButton consensoId={viewing.id} />
                    {isMedico && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void revoca(viewing)}
                        className="text-destructive"
                      >
                        <XCircle className="h-4 w-4" />
                        Revoca consenso
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PdfLink({
  path,
  getUrl,
}: {
  path: string;
  getUrl: () => Promise<string | null>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    void getUrl().then(setUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
  if (!url) return <p className="text-xs text-muted-foreground">Caricamento PDF…</p>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mt-1 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent"
    >
      <FileText className="h-4 w-4" />
      Apri PDF firmato
    </a>
  );
}

function NuovoConsensoDialog({
  pazienteId,
  templates,
  onClose,
  onSaved,
}: {
  pazienteId: string;
  templates: ConsensoTemplate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [tplId, setTplId] = useState("");
  const [modalita, setModalita] = useState<ConsensoModalitaFirma>("tablet");
  const [note, setNote] = useState("");
  const [signed, setSigned] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  // Metadati cartaceo
  const [dataFirmaCartaceo, setDataFirmaCartaceo] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [esitoCartaceo, setEsitoCartaceo] = useState<"acconsento" | "non_acconsento">(
    "acconsento",
  );
  const sigRef = React.useRef<SignaturePadHandle>(null);

  const tpl = templates.find((t) => t.id === tplId) ?? null;

  function reset() {
    setTplId("");
    setModalita("tablet");
    setNote("");
    setSigned(false);
    setPdfFile(null);
    setDataFirmaCartaceo(new Date().toISOString().slice(0, 10));
    setEsitoCartaceo("acconsento");
    sigRef.current?.clear();
  }

  function stampaTemplate() {
    if (!tpl) return;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Abilita i popup per stampare");
      return;
    }
    const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${tpl.titolo}</title><style>
      body{font-family:Georgia,serif;max-width:780px;margin:32px auto;padding:0 24px;color:#111}
      h1{font-size:20px;margin:0 0 4px}
      .meta{font-size:11px;color:#666;margin-bottom:18px}
      pre{white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.5}
      .firme{margin-top:48px;display:grid;grid-template-columns:1fr 1fr;gap:32px}
      .firma{border-top:1px solid #333;padding-top:6px;font-size:11px;color:#444}
      .scelta{margin:24px 0;font-size:13px}
      .scelta label{display:inline-flex;align-items:center;gap:6px;margin-right:18px}
      @media print{body{margin:0}}
      </style></head><body>
      <h1>${tpl.titolo}</h1>
      <div class="meta">Versione ${tpl.versione} · da firmare a mano</div>
      <pre>${tpl.testo.replace(/[<>&]/g, (c) => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]!))}</pre>
      <div class="scelta">
        Scelta del paziente:
        <label>☐ Acconsento</label>
        <label>☐ Non acconsento</label>
      </div>
      <div class="firme">
        <div class="firma">Firma del paziente · data __________</div>
        <div class="firma">Firma del medico · data __________</div>
      </div>
      <script>window.onload=()=>setTimeout(()=>window.print(),200)</script>
      </body></html>`;
    w.document.write(html);
    w.document.close();
  }

  function calcValidoFinoA(t: ConsensoTemplate, firmatoIl: Date): string | null {
    // Trattamento singolo: validità legata alla seduta, nessuna scadenza temporale
    if (t.categoria === "trattamento_singolo") return null;
    // Cicli: forza default 12 mesi se non valorizzato
    if (t.categoria === "trattamento_ciclo") {
      const mesi = t.validita_mesi && t.validita_mesi > 0 ? t.validita_mesi : 12;
      const d = new Date(firmatoIl);
      d.setMonth(d.getMonth() + mesi);
      return d.toISOString();
    }
    if (t.validita_mesi == null || t.validita_mesi <= 0) return null;
    const d = new Date(firmatoIl);
    d.setMonth(d.getMonth() + t.validita_mesi);
    return d.toISOString();
  }

  async function salva() {
    if (!tpl) {
      toast.error("Seleziona un modello");
      return;
    }
    if (modalita === "tablet" && (!sigRef.current || sigRef.current.isEmpty())) {
      toast.error("La firma è obbligatoria");
      return;
    }
    if (modalita === "pdf_caricato" && !pdfFile) {
      toast.error("Carica il PDF firmato");
      return;
    }
    setSaving(true);
    // Per il cartaceo usiamo la data dichiarata; per tablet la data di firma effettiva
    const firmatoIl =
      modalita === "pdf_caricato" && dataFirmaCartaceo
        ? new Date(`${dataFirmaCartaceo}T12:00:00`)
        : new Date();
    const validoFinoA = calcValidoFinoA(tpl, firmatoIl);
    const isRifiutato = modalita === "pdf_caricato" && esitoCartaceo === "non_acconsento";

    let firmaImmagine: string | null = null;
    let pdfPath: string | null = null;

    if (modalita === "tablet") {
      firmaImmagine = sigRef.current!.toDataURL();
    } else if (pdfFile) {
      const ext = pdfFile.name.split(".").pop()?.toLowerCase() ?? "pdf";
      const path = `${pazienteId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage
        .from("consensi-pdf")
        .upload(path, pdfFile, { contentType: pdfFile.type });
      if (up.error) {
        toast.error(`Errore upload: ${up.error.message}`);
        setSaving(false);
        return;
      }
      pdfPath = path;
    }

    const integrita = await sha256Hex(
      `${tpl.titolo}|${tpl.testo}|${tpl.versione}|${firmatoIl.toISOString()}|${
        firmaImmagine?.length ?? pdfFile?.size ?? 0
      }|${modalita}|${isRifiutato ? "rif" : "acc"}`,
    );

    const noteFinali =
      modalita === "pdf_caricato"
        ? [
            `Firma cartacea — esito: ${isRifiutato ? "Non acconsento" : "Acconsento"}`,
            note.trim() ? note.trim() : null,
          ]
            .filter(Boolean)
            .join("\n")
        : note.trim() || null;

    const { error } = await supabase.from("consenso_firmato").insert({
      paziente_id: pazienteId,
      template_id: tpl.id,
      titolo_snapshot: tpl.titolo,
      testo_snapshot: tpl.testo,
      versione_snapshot: tpl.versione,
      categoria_snapshot: tpl.categoria,
      validita_mesi_snapshot: tpl.validita_mesi,
      modalita_firma: modalita,
      firma_immagine: firmaImmagine,
      pdf_url: pdfPath,
      firmato_il: firmatoIl.toISOString(),
      valido_fino_a: isRifiutato ? null : validoFinoA,
      user_agent: navigator.userAgent,
      operatore_testimone: user?.id ?? null,
      hash_integrita: integrita,
      rifiutato: isRifiutato,
      note: noteFinali,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Consenso archiviato");
    reset();
    onSaved();
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="font-display">Nuovo consenso informato</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Modello *</Label>
          <Select value={tplId} onValueChange={setTplId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona un modello…" />
            </SelectTrigger>
            <SelectContent>
              {templates.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  Nessun modello attivo. Creane uno in Consensi → Nuovo modello.
                </div>
              ) : (
                templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.titolo} (v{t.versione}) · {CATEGORIA_LABELS[t.categoria]}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {tpl && (
          <>
            <div className="max-h-40 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="whitespace-pre-wrap">{tpl.testo}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {tpl.validita_mesi
                ? `Validità: ${tpl.validita_mesi} mesi dalla firma.`
                : "Nessuna scadenza temporale (valido finché non cambia versione o non viene revocato)."}
            </p>
          </>
        )}

        <div>
          <Label>Modalità di firma *</Label>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={modalita === "tablet" ? "default" : "outline"}
              onClick={() => setModalita("tablet")}
            >
              <PenLine className="h-4 w-4" />
              Firma su tablet
            </Button>
            <Button
              type="button"
              variant={modalita === "pdf_caricato" ? "default" : "outline"}
              onClick={() => setModalita("pdf_caricato")}
            >
              <Upload className="h-4 w-4" />
              Carica PDF firmato
            </Button>
          </div>
        </div>

        {modalita === "tablet" ? (
          <div>
            <Label>Firma del paziente *</Label>
            <SignaturePad
              ref={sigRef}
              onChange={(empty) => setSigned(!empty)}
            />
          </div>
        ) : (
          <div>
            <Label>PDF firmato *</Label>
            <Input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
            />
            {pdfFile && (
              <p className="mt-1 text-xs text-muted-foreground">
                {pdfFile.name} · {(pdfFile.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
        )}

        <div>
          <Label>Note (facoltative)</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          Annulla
        </Button>
        <Button
          onClick={salva}
          disabled={
            saving ||
            !tpl ||
            (modalita === "tablet" && !signed) ||
            (modalita === "pdf_caricato" && !pdfFile)
          }
        >
          {saving ? "Archiviazione…" : "Conferma e archivia"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
