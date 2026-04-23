import * as React from "react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { FileSignature, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SignaturePad, type SignaturePadHandle } from "@/components/signature-pad";
import { sha256Hex } from "@/lib/hash";
import type {
  ConsensoFirmato,
  ConsensoTemplate,
} from "@/types/trattamenti";

export function ConsensiPanel({ pazienteId }: { pazienteId: string }) {
  const { user } = useAuth();
  const [firmati, setFirmati] = useState<ConsensoFirmato[]>([]);
  const [templates, setTemplates] = useState<ConsensoTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDlg, setOpenDlg] = useState(false);
  const [tplId, setTplId] = useState<string>("");
  const [note, setNote] = useState("");
  const [signed, setSigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<ConsensoFirmato | null>(null);
  const sigRef = React.useRef<SignaturePadHandle>(null);

  useEffect(() => {
    void load();
  }, [pazienteId]);

  async function load() {
    setLoading(true);
    const [fRes, tRes] = await Promise.all([
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
    ]);
    setFirmati((fRes.data ?? []) as ConsensoFirmato[]);
    setTemplates((tRes.data ?? []) as ConsensoTemplate[]);
    setLoading(false);
  }

  const tpl = templates.find((t) => t.id === tplId) ?? null;

  function reset() {
    setTplId("");
    setNote("");
    setSigned(false);
    sigRef.current?.clear();
  }

  async function firma() {
    if (!tpl) {
      toast.error("Seleziona un modello di consenso");
      return;
    }
    if (!sigRef.current || sigRef.current.isEmpty()) {
      toast.error("La firma è obbligatoria");
      return;
    }
    setSaving(true);
    const dataUrl = sigRef.current.toDataURL();
    const firmatoIl = new Date().toISOString();
    const integrita = await sha256Hex(
      `${tpl.titolo}|${tpl.testo}|${tpl.versione}|${firmatoIl}|${dataUrl.length}`,
    );
    const { error } = await supabase.from("consenso_firmato").insert({
      paziente_id: pazienteId,
      template_id: tpl.id,
      titolo_snapshot: tpl.titolo,
      testo_snapshot: tpl.testo,
      versione_snapshot: tpl.versione,
      firma_immagine: dataUrl,
      firmato_il: firmatoIl,
      user_agent: navigator.userAgent,
      operatore_testimone: user?.id ?? null,
      hash_integrita: integrita,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Consenso firmato e archiviato");
    setOpenDlg(false);
    reset();
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">
            Consensi firmati
          </h3>
          <p className="text-xs text-muted-foreground">
            Archivio storico, immutabile.
          </p>
        </div>
        <Dialog
          open={openDlg}
          onOpenChange={(v) => {
            setOpenDlg(v);
            if (!v) reset();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              Nuovo consenso
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-display">
                Firma consenso informato
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Modello</Label>
                <Select value={tplId} onValueChange={setTplId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona un modello…" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        Nessun modello attivo
                      </div>
                    ) : (
                      templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.titolo} (v{t.versione})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {tpl && (
                <div className="max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{tpl.testo}</p>
                </div>
              )}
              <div>
                <Label>Note (facoltative)</Label>
                <Textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              <div>
                <Label>Firma del paziente *</Label>
                <SignaturePad
                  ref={sigRef}
                  onChange={(empty) => setSigned(!empty)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={firma} disabled={saving || !tpl || !signed}>
                {saving ? "Archiviazione…" : "Conferma e archivia"}
              </Button>
            </DialogFooter>
          </DialogContent>
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
          {firmati.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer transition-colors hover:bg-accent/30"
              onClick={() => setViewing(c)}
            >
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-success-foreground" />
                    <span className="font-medium">{c.titolo_snapshot}</span>
                    <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      v{c.versione_snapshot}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Firmato il{" "}
                    {new Date(c.firmato_il).toLocaleString("it-IT", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <img
                  src={c.firma_immagine}
                  alt="firma"
                  className="h-12 w-32 rounded border border-border bg-card object-contain"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={!!viewing}
        onOpenChange={(v) => !v && setViewing(null)}
      >
        <DialogContent className="max-w-2xl">
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
                <p className="text-xs text-muted-foreground">
                  Firmato il{" "}
                  {new Date(viewing.firmato_il).toLocaleString("it-IT")}
                </p>
                <div className="max-h-64 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{viewing.testo_snapshot}</p>
                </div>
                <div>
                  <Label>Firma</Label>
                  <img
                    src={viewing.firma_immagine}
                    alt="firma paziente"
                    className="mt-1 h-32 w-full rounded border border-border bg-card object-contain"
                  />
                </div>
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
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
