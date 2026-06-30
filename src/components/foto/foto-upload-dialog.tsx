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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadFoto } from "@/lib/foto-clinica";
import { ZONE_PREDEFINITE } from "@/lib/zone-trattamento";
import type { FotoMomento } from "@/types/foto-clinica";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  paziente_id: string;
  piano_id: string;
  /** Se valorizzato, le foto sono di seduta. Altrimenti di piano. */
  seduta_id?: string | null;
  /** Pre-imposta il momento (utile per pulsanti "+ PRIMA" / "+ DOPO" rapidi) */
  defaultMomento?: FotoMomento;
  defaultData?: string;
  onUploaded?: () => void;
}

function todayISO() {
  const d = new Date();
  const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
  return iso;
}

export function FotoUploadDialog({
  open,
  onOpenChange,
  paziente_id,
  piano_id,
  seduta_id,
  defaultMomento,
  defaultData,
  onUploaded,
}: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [momento, setMomento] = useState<FotoMomento>(defaultMomento ?? "prima");
  const [zona, setZona] = useState<string>("__none__");
  const [dataScatto, setDataScatto] = useState<string>(defaultData ?? todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFiles([]);
      setMomento(defaultMomento ?? "prima");
      setZona("__none__");
      setDataScatto(defaultData ?? todayISO());
      setNote("");
    }
  }, [open, defaultMomento, defaultData]);

  async function handleSubmit() {
    if (files.length === 0) {
      toast.error("Seleziona almeno una foto");
      return;
    }
    setSaving(true);
    try {
      for (const file of files) {
        await uploadFoto({
          paziente_id,
          piano_id,
          seduta_id: seduta_id ?? null,
          momento,
          zona: zona === "__none__" ? null : zona,
          data_scatto: dataScatto,
          note: note.trim() || null,
          file,
        });
      }
      toast.success(`${files.length} foto caricate`);
      onUploaded?.();
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore caricamento";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Carica foto cliniche</DialogTitle>
          <DialogDescription>
            {seduta_id
              ? "Foto associate a questa seduta."
              : "Foto associate al piano (PRIMA o finali)."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="files">File</Label>
            <Input
              id="files"
              type="file"
              accept="image/*"
              {...(isMobileDevice()
                ? { capture: "environment" as const }
                : { multiple: true })}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {files.length} file selezionati
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Momento *</Label>
            <RadioGroup
              value={momento}
              onValueChange={(v) => setMomento(v as FotoMomento)}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="prima" id="m-prima" />
                <Label htmlFor="m-prima" className="font-normal">
                  Scattata PRIMA del trattamento
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="dopo" id="m-dopo" />
                <Label htmlFor="m-dopo" className="font-normal">
                  Scattata DOPO
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="data">Data scatto *</Label>
              <Input
                id="data"
                type="date"
                value={dataScatto}
                max={todayISO()}
                onChange={(e) => setDataScatto(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Zona (facoltativo)</Label>
              <Select value={zona} onValueChange={setZona}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— nessuna —</SelectItem>
                  {ZONE_PREDEFINITE.map((z) => (
                    <SelectItem key={z} value={z}>
                      {z}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Note (facoltativo)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={saving || files.length === 0}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Caricamento…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> Carica
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
