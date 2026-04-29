import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Plus, Settings2 } from "lucide-react";
import { addDays, fmtDataLunga, startOfDay, startOfWeek } from "@/lib/calendario";
import { useCalendarioEventi, type FiltriCalendario } from "@/hooks/use-calendario-eventi";
import { CalendarioVista } from "@/components/calendario/calendario-vista";
import { CalendarioFiltri } from "@/components/calendario/calendario-filtri";
import { EventoEditDialog } from "@/components/calendario/evento-edit-dialog";
import { CalendarioPreferenzeDialog } from "@/components/calendario/calendario-preferenze-dialog";
import { supabase } from "@/integrations/supabase/client";
import type { CalendarioVistaEvento, EventoCalendario, VistaCalendario } from "@/types/calendario";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/calendario")({
  component: CalendarioPage,
});

function CalendarioPage() {
  const navigate = useNavigate();
  const [vista, setVista] = useState<VistaCalendario>("settimana");
  const [giornoCorrente, setGiornoCorrente] = useState<Date>(() => startOfDay(new Date()));
  const [filtri, setFiltri] = useState<FiltriCalendario>({
    mostraSedute: true,
    mostraEventi: true,
    mostraScadenze: true,
    paziente_id: null,
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editEvento, setEditEvento] = useState<EventoCalendario | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | undefined>();
  const [prefsOpen, setPrefsOpen] = useState(false);

  const { from, to } = useMemo(() => {
    if (vista === "giorno") {
      const f = startOfDay(giornoCorrente);
      const t = new Date(f); t.setHours(23, 59, 59, 999);
      return { from: f, to: t };
    }
    const f = startOfWeek(giornoCorrente);
    const t = addDays(f, 7); t.setMilliseconds(-1);
    return { from: f, to: t };
  }, [vista, giornoCorrente]);

  const { eventi, loading, reload } = useCalendarioEventi({ from, to, filtri });

  const titoloPeriodo = useMemo(() => {
    if (vista === "giorno") return fmtDataLunga(giornoCorrente);
    const fineSett = addDays(from, 6);
    return `${from.toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} – ${fineSett.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}`;
  }, [vista, from, giornoCorrente]);

  const sposta = (delta: number) => {
    setGiornoCorrente((d) => addDays(d, vista === "giorno" ? delta : delta * 7));
  };

  const handleClickEvento = (ev: CalendarioVistaEvento) => {
    if (ev.source === "seduta") {
      if (ev.paziente_id) {
        navigate({ to: "/pazienti/$id", params: { id: ev.paziente_id } });
      }
      return;
    }
    if (ev.source === "scadenza_lotto") {
      navigate({ to: "/magazzino" });
      return;
    }
    setEditEvento(ev.raw as EventoCalendario);
    setDefaultStart(undefined);
    setEditOpen(true);
  };

  const handleClickSlot = (giorno: Date, ora: number) => {
    const d = new Date(giorno);
    d.setHours(ora, 0, 0, 0);
    setEditEvento(null);
    setDefaultStart(d);
    setEditOpen(true);
  };

  const handleMove = async (eventoId: string, nuovoStart: Date) => {
    if (!eventoId.startsWith("evento:")) return;
    const id = eventoId.slice("evento:".length);
    const evento = eventi.find((e) => e.id === eventoId);
    if (!evento) return;

    // Mantieni la durata
    const durataMs = evento.end ? evento.end.getTime() - evento.start.getTime() : 0;
    const nuovoEnd = durataMs > 0 ? new Date(nuovoStart.getTime() + durataMs) : null;

    const { error } = await supabase
      .from("evento_calendario")
      .update({
        data_inizio: nuovoStart.toISOString(),
        data_fine: nuovoEnd ? nuovoEnd.toISOString() : null,
      })
      .eq("id", id);
    if (error) {
      toast.error("Impossibile spostare l'evento");
      return;
    }
    toast.success("Evento spostato");
    reload();
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link to="/dashboard" className="hover:underline">Dashboard</Link> / Calendario
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Calendario</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPrefsOpen(true)}>
            <Settings2 className="mr-1 h-4 w-4" /> Preferenze
          </Button>
          <Button size="sm" onClick={() => { setEditEvento(null); setDefaultStart(new Date()); setEditOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Nuovo evento
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => sposta(-1)} aria-label="Precedente">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setGiornoCorrente(startOfDay(new Date()))}>
                Oggi
              </Button>
              <Button variant="outline" size="icon" onClick={() => sposta(1)} aria-label="Successivo">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="ml-2 text-sm font-medium capitalize">{titoloPeriodo}</span>
            </div>

            <div className="flex items-center gap-1 rounded-md border p-0.5">
              <Button
                variant={vista === "settimana" ? "default" : "ghost"}
                size="sm"
                onClick={() => setVista("settimana")}
              >
                Settimana
              </Button>
              <Button
                variant={vista === "giorno" ? "default" : "ghost"}
                size="sm"
                onClick={() => setVista("giorno")}
              >
                Giorno
              </Button>
            </div>
          </div>

          <CalendarioFiltri filtri={filtri} onChange={setFiltri} />

          <div className="relative">
            {loading && (
              <div className="absolute right-2 top-2 z-10 rounded bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
                Aggiornamento…
              </div>
            )}
            <CalendarioVista
              vista={vista}
              giornoCorrente={giornoCorrente}
              eventi={eventi}
              onClickEvento={handleClickEvento}
              onClickSlot={handleClickSlot}
              onMoveEvento={handleMove}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Click su una cella vuota per creare un evento. Le sedute sono sola lettura: cliccale per aprire il paziente.
          </p>
        </CardContent>
      </Card>

      <EventoEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        evento={editEvento}
        defaultStart={defaultStart}
        onSaved={reload}
      />
      <CalendarioPreferenzeDialog open={prefsOpen} onOpenChange={setPrefsOpen} />
    </div>
  );
}
