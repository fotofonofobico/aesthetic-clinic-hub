import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight, Loader2 } from "lucide-react";
import { useCalendarioEventi } from "@/hooks/use-calendario-eventi";
import { addDays, fmtData, fmtOra, ordinaEventi } from "@/lib/calendario";

export function CalendarioWidget() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const to = addDays(today, 7);
  to.setHours(23, 59, 59, 999);

  const { eventi, loading, error } = useCalendarioEventi({
    from: today,
    to,
    filtri: { mostraSedute: true, mostraEventi: true, mostraScadenze: false, paziente_id: null },
  });

  const prossimi = ordinaEventi(eventi).slice(0, 6);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4" /> Prossimi 7 giorni
        </CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to="/calendario">
            Apri <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Caricamento…
          </div>
        )}
        {error && <p className="text-xs text-muted-foreground">Calendario non disponibile</p>}
        {!loading && !error && prossimi.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessun evento in programma</p>
        )}
        {prossimi.map((ev) => (
          <div key={ev.id} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: ev.colore }} />
            <span className="w-20 shrink-0 text-xs text-muted-foreground">
              {fmtData(ev.start)} {!ev.tutto_il_giorno && fmtOra(ev.start)}
            </span>
            <span className="truncate">{ev.titolo}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
