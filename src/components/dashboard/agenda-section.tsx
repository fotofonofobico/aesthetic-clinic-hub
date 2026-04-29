import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Plus, Loader2 } from "lucide-react";
import { useCalendarioEventi } from "@/hooks/use-calendario-eventi";
import { addDays, fmtOra, ordinaEventi, startOfDay } from "@/lib/calendario";
import { EventoEditDialog } from "@/components/calendario/evento-edit-dialog";

export function AgendaSection() {
  const navigate = useNavigate();
  const [openNew, setOpenNew] = useState(false);

  const today = startOfDay(new Date());
  const to = addDays(today, 7);
  to.setHours(23, 59, 59, 999);

  const { eventi, loading, reload } = useCalendarioEventi({
    from: today,
    to,
    filtri: { mostraSedute: true, mostraEventi: true, mostraScadenze: false, paziente_id: null },
  });

  const ordinati = ordinaEventi(eventi).slice(0, 10);

  // raggruppa per giorno
  const gruppi: Record<string, typeof ordinati> = {};
  ordinati.forEach((e) => {
    const k = startOfDay(e.start).toISOString();
    (gruppi[k] ||= []).push(e);
  });

  return (
    <>
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" /> Agenda — prossimi 7 giorni
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4" /> Aggiungi
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Caricamento…
            </div>
          )}
          {!loading && ordinati.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nessun appuntamento nei prossimi 7 giorni.
            </p>
          )}
          {Object.entries(gruppi).map(([k, lista]) => (
            <div key={k}>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {fmtGiorno(new Date(k))}
              </p>
              <ul className="space-y-1">
                {lista.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50"
                    onClick={() => {
                      if (ev.paziente_id) {
                        void navigate({ to: "/pazienti/$id", params: { id: ev.paziente_id } });
                      } else {
                        void navigate({ to: "/calendario" });
                      }
                    }}
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: ev.colore }}
                    />
                    <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {ev.tutto_il_giorno ? "—" : fmtOra(ev.start)}
                    </span>
                    <span className="truncate">{ev.titolo}</span>
                    {ev.sottotitolo && (
                      <span className="truncate text-xs text-muted-foreground">
                        · {ev.sottotitolo}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <EventoEditDialog
        open={openNew}
        onOpenChange={setOpenNew}
        defaultStart={new Date()}
        onSaved={reload}
      />
    </>
  );
}

function fmtGiorno(d: Date) {
  const today = startOfDay(new Date()).getTime();
  const t = d.getTime();
  if (t === today) return "Oggi";
  if (t === today + 86400000) return "Domani";
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "2-digit", month: "short" });
}
