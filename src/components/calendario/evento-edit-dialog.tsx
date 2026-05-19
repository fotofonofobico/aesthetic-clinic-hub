import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { CalendarioEventoTipo, EventoCalendario } from "@/types/calendario";
import { TIPO_LABEL, toLocalInput, fromLocalInput } from "@/lib/calendario";
import { PazienteSearch } from "@/components/paziente/paziente-search";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evento?: EventoCalendario | null;
  defaultStart?: Date;
  defaultPazienteId?: string | null;
  onSaved?: () => void;
}

export function EventoEditDialog({
  open,
  onOpenChange,
  evento,
  defaultStart,
  defaultPazienteId,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const isEdit = !!evento;

  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [tipo, setTipo] = useState<CalendarioEventoTipo>("promemoria");
  const [dataInizio, setDataInizio] = useState("");
  const [dataFine, setDataFine] = useState("");
  const [modoFine, setModoFine] = useState<"durata" | "fine">("durata");
  const [durataMinuti, setDurataMinuti] = useState<number>(60);
  const [tuttoIlGiorno, setTuttoIlGiorno] = useState(false);
  const [pazienteId, setPazienteId] = useState<string | null>(null);
  const [sincronizzaDiario, setSincronizzaDiario] = useState(false);
  const [completato, setCompletato] = useState(false);
  const [saving, setSaving] = useState(false);

  const DURATE_PRESET = [15, 30, 45, 60, 90, 120];

  useEffect(() => {
    if (!open) return;
    if (evento) {
      setTitolo(evento.titolo);
      setDescrizione(evento.descrizione ?? "");
      setTipo(evento.tipo);
      const startD = new Date(evento.data_inizio);
      setDataInizio(toLocalInput(startD));
      if (evento.data_fine) {
        const endD = new Date(evento.data_fine);
        const diffMin = Math.round((endD.getTime() - startD.getTime()) / 60000);
        if (diffMin > 0 && diffMin <= 480 && diffMin % 5 === 0) {
          setModoFine("durata");
          setDurataMinuti(diffMin);
          setDataFine("");
        } else {
          setModoFine("fine");
          setDataFine(toLocalInput(endD));
          setDurataMinuti(60);
        }
      } else {
        setModoFine("durata");
        setDurataMinuti(60);
        setDataFine("");
      }
      setTuttoIlGiorno(evento.tutto_il_giorno);
      setPazienteId(evento.paziente_id);
      setSincronizzaDiario(evento.sincronizza_diario);
      setCompletato(evento.completato);
    } else {
      const start = defaultStart ?? new Date();
      setTitolo("");
      setDescrizione("");
      setTipo("promemoria");
      setDataInizio(toLocalInput(start));
      setDataFine("");
      setModoFine("durata");
      setDurataMinuti(60);
      setTuttoIlGiorno(false);
      setPazienteId(defaultPazienteId ?? null);
      setSincronizzaDiario(false);
      setCompletato(false);
    }
  }, [open, evento, defaultStart, defaultPazienteId]);

  const handleSave = async () => {
    if (!titolo.trim()) {
      toast.error("Titolo obbligatorio");
      return;
    }
    if (!dataInizio) {
      toast.error("Data inizio obbligatoria");
      return;
    }
    if (sincronizzaDiario && !pazienteId) {
      toast.error("Per sincronizzare nel diario seleziona un paziente");
      return;
    }
    const startDate = fromLocalInput(dataInizio);
    let fineIso: string | null = null;
    if (!tuttoIlGiorno) {
      if (modoFine === "durata") {
        if (durataMinuti && durataMinuti > 0) {
          fineIso = new Date(startDate.getTime() + durataMinuti * 60_000).toISOString();
        }
      } else if (dataFine) {
        const endDate = fromLocalInput(dataFine);
        if (endDate.getTime() < startDate.getTime()) {
          toast.error("La data di fine deve essere successiva all'inizio");
          return;
        }
        fineIso = endDate.toISOString();
      }
    }
    setSaving(true);
    try {
      const payload: any = {
        titolo: titolo.trim(),
        descrizione: descrizione.trim() || null,
        tipo,
        data_inizio: startDate.toISOString(),
        data_fine: fineIso,
        tutto_il_giorno: tuttoIlGiorno,
        paziente_id: pazienteId,
        sincronizza_diario: sincronizzaDiario,
        completato,
      };

      let savedId: string;
      let oldNotaId: string | null = null;

      if (isEdit && evento) {
        oldNotaId = evento.nota_diario_id;
        const { error } = await supabase
          .from("evento_calendario")
          .update(payload)
          .eq("id", evento.id);
        if (error) throw error;
        savedId = evento.id;
      } else {
        payload.created_by = user?.id;
        const { data, error } = await supabase
          .from("evento_calendario")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        savedId = data!.id;
      }

      // Sync diario
      if (sincronizzaDiario && pazienteId) {
        const testo = `[Calendario] ${titolo.trim()}${descrizione.trim() ? "\n" + descrizione.trim() : ""}`;
        if (oldNotaId) {
          await supabase
            .from("paziente_nota")
            .update({ testo, data_evento: payload.data_inizio })
            .eq("id", oldNotaId);
        } else {
          const { data: nota } = await supabase
            .from("paziente_nota")
            .insert({
              paziente_id: pazienteId,
              tipo: "clinica",
              testo,
              data_evento: payload.data_inizio,
              created_by: user?.id,
              auto_generata: true,
            })
            .select("id")
            .single();
          if (nota) {
            await supabase
              .from("evento_calendario")
              .update({ nota_diario_id: nota.id })
              .eq("id", savedId);
          }
        }
      } else if (!sincronizzaDiario && oldNotaId) {
        // Rimuovi nota collegata
        await supabase.from("paziente_nota").delete().eq("id", oldNotaId).eq("auto_generata", true);
        await supabase
          .from("evento_calendario")
          .update({ nota_diario_id: null })
          .eq("id", savedId);
      }

      toast.success(isEdit ? "Evento aggiornato" : "Evento creato");
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore di salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!evento) return;
    const ok = await confirmDialog({
      title: "Eliminare evento",
      description: "Eliminare questo evento?",
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    try {
      if (evento.nota_diario_id) {
        await supabase
          .from("paziente_nota")
          .delete()
          .eq("id", evento.nota_diario_id)
          .eq("auto_generata", true);
      }
      const { error } = await supabase.from("evento_calendario").delete().eq("id", evento.id);
      if (error) throw error;
      toast.success("Evento eliminato");
      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      toast.error(err.message || "Errore");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifica evento" : "Nuovo evento"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="ev-titolo">Titolo *</Label>
            <Input
              id="ev-titolo"
              value={titolo}
              onChange={(e) => setTitolo(e.target.value)}
              placeholder="es. Richiamare paziente"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as CalendarioEventoTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_LABEL) as CalendarioEventoTipo[]).map((t) => (
                    <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Paziente (opzionale)</Label>
              <PazienteSearch value={pazienteId} onChange={setPazienteId} />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ev-start">Inizio *</Label>
            <Input id="ev-start" type="datetime-local" value={dataInizio} onChange={(e) => setDataInizio(e.target.value)} />
          </div>

          {!tuttoIlGiorno && (
            <div className="space-y-2 rounded-md border bg-muted/20 p-2.5">
              <div className="flex items-center gap-1 rounded-md border bg-background p-0.5 w-fit">
                <Button
                  type="button"
                  variant={modoFine === "durata" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setModoFine("durata")}
                >
                  Durata
                </Button>
                <Button
                  type="button"
                  variant={modoFine === "fine" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setModoFine("fine")}
                >
                  Fine specifica
                </Button>
              </div>

              {modoFine === "durata" ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      id="ev-durata"
                      type="number"
                      min={0}
                      step={5}
                      value={durataMinuti}
                      onChange={(e) => setDurataMinuti(Number(e.target.value) || 0)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">minuti</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {DURATE_PRESET.map((m) => (
                      <Button
                        key={m}
                        type="button"
                        variant={durataMinuti === m ? "secondary" : "outline"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setDurataMinuti(m)}
                      >
                        {m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h${m % 60}`}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="ev-end">Fine</Label>
                  <Input id="ev-end" type="datetime-local" value={dataFine} onChange={(e) => setDataFine(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox id="ev-allday" checked={tuttoIlGiorno} onCheckedChange={(v) => setTuttoIlGiorno(!!v)} />
            <Label htmlFor="ev-allday" className="cursor-pointer text-sm font-normal">Tutto il giorno</Label>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ev-desc">Descrizione</Label>
            <Textarea id="ev-desc" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} rows={2} />
          </div>

          {pazienteId && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
              <Checkbox
                id="ev-sync"
                checked={sincronizzaDiario}
                onCheckedChange={(v) => setSincronizzaDiario(!!v)}
              />
              <Label htmlFor="ev-sync" className="cursor-pointer text-sm font-normal">
                Crea/aggiorna nota nel diario paziente
              </Label>
            </div>
          )}

          {isEdit && (
            <div className="flex items-center gap-2">
              <Checkbox id="ev-done" checked={completato} onCheckedChange={(v) => setCompletato(!!v)} />
              <Label htmlFor="ev-done" className="cursor-pointer text-sm font-normal">Completato</Label>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {isEdit ? (
            <Button variant="ghost" size="sm" onClick={handleDelete} disabled={saving} className="text-destructive">
              <Trash2 className="mr-1 h-4 w-4" /> Elimina
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annulla</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Salva" : "Crea"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
