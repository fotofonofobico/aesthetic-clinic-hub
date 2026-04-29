import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { CalendarioVistaEvento, VistaCalendario } from "@/types/calendario";
import { addDays, eventiDelGiorno, fmtOra, ordinaEventi, startOfDay } from "@/lib/calendario";
import { cn } from "@/lib/utils";

interface Props {
  vista: VistaCalendario;
  giornoCorrente: Date;
  eventi: CalendarioVistaEvento[];
  onClickEvento: (e: CalendarioVistaEvento) => void;
  onClickSlot: (giorno: Date, ora: number) => void;
  onMoveEvento: (eventoId: string, nuovoStart: Date) => void;
}

const ORE = Array.from({ length: 14 }, (_, i) => i + 7); // 7-20

export function CalendarioVista({
  vista, giornoCorrente, eventi, onClickEvento, onClickSlot, onMoveEvento,
}: Props) {
  const giorni = useMemo(() => {
    if (vista === "giorno") return [startOfDay(giornoCorrente)];
    const lun = (() => {
      const d = new Date(giornoCorrente);
      const day = (d.getDay() + 6) % 7;
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - day);
      return d;
    })();
    return Array.from({ length: 7 }, (_, i) => addDays(lun, i));
  }, [vista, giornoCorrente]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    const eventoId = String(e.active.id);
    const [giornoIdx, ora] = String(e.over.id).split(":").map(Number);
    const nuovoGiorno = giorni[giornoIdx];
    if (!nuovoGiorno || isNaN(ora)) return;
    const nuovo = new Date(nuovoGiorno);
    nuovo.setHours(ora, 0, 0, 0);
    onMoveEvento(eventoId, nuovo);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="overflow-hidden rounded-lg border">
        {/* Header giorni */}
        <div
          className="grid border-b bg-muted/30 text-xs font-medium"
          style={{ gridTemplateColumns: `60px repeat(${giorni.length}, 1fr)` }}
        >
          <div className="p-2" />
          {giorni.map((g, i) => (
            <div key={i} className="border-l p-2 text-center">
              <div className="capitalize text-muted-foreground">
                {g.toLocaleDateString("it-IT", { weekday: "short" })}
              </div>
              <div
                className={cn(
                  "text-base font-semibold",
                  isOggi(g) && "text-primary",
                )}
              >
                {g.getDate()}
              </div>
            </div>
          ))}
        </div>

        {/* All-day strip */}
        <div
          className="grid border-b bg-muted/10"
          style={{ gridTemplateColumns: `60px repeat(${giorni.length}, 1fr)` }}
        >
          <div className="p-1 text-[10px] uppercase text-muted-foreground">tutto il g.</div>
          {giorni.map((g, gi) => {
            const allday = ordinaEventi(eventiDelGiorno(eventi, g)).filter((e) => e.tutto_il_giorno);
            return (
              <div key={gi} className="min-h-[28px] border-l p-1">
                {allday.map((ev) => (
                  <EventoMini key={ev.id} ev={ev} onClick={() => onClickEvento(ev)} />
                ))}
              </div>
            );
          })}
        </div>

        {/* Griglia oraria */}
        <div className="max-h-[60vh] overflow-y-auto">
          {ORE.map((ora) => (
            <div
              key={ora}
              className="grid border-b last:border-0"
              style={{ gridTemplateColumns: `60px repeat(${giorni.length}, 1fr)` }}
            >
              <div className="border-r p-1 text-right text-[11px] text-muted-foreground">
                {String(ora).padStart(2, "0")}:00
              </div>
              {giorni.map((g, gi) => (
                <SlotCella
                  key={gi}
                  giorno={g}
                  giornoIdx={gi}
                  ora={ora}
                  eventi={ordinaEventi(eventiDelGiorno(eventi, g)).filter(
                    (e) => !e.tutto_il_giorno && e.start.getHours() === ora,
                  )}
                  onClickSlot={() => onClickSlot(g, ora)}
                  onClickEvento={onClickEvento}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </DndContext>
  );
}

function isOggi(d: Date) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function SlotCella({
  giorno, giornoIdx, ora, eventi, onClickSlot, onClickEvento,
}: {
  giorno: Date;
  giornoIdx: number;
  ora: number;
  eventi: CalendarioVistaEvento[];
  onClickSlot: () => void;
  onClickEvento: (e: CalendarioVistaEvento) => void;
}) {
  void giorno;
  const { setNodeRef, isOver } = useDroppable({ id: `${giornoIdx}:${ora}` });
  return (
    <div
      ref={setNodeRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClickSlot();
      }}
      className={cn(
        "relative min-h-[48px] cursor-pointer border-l p-0.5 transition-colors hover:bg-muted/40",
        isOver && "bg-primary/10",
      )}
    >
      {eventi.map((ev) => (
        <EventoBlocco key={ev.id} ev={ev} onClick={() => onClickEvento(ev)} />
      ))}
    </div>
  );
}

function EventoBlocco({ ev, onClick }: { ev: CalendarioVistaEvento; onClick: () => void }) {
  const isDraggable = ev.source === "evento";
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ev.id,
    disabled: !isDraggable,
  });
  const style: React.CSSProperties = {
    background: ev.colore,
    color: "white",
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDraggable ? "grab" : "pointer",
  };
  return (
    <div
      ref={setNodeRef}
      {...(isDraggable ? listeners : {})}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={style}
      className="mb-0.5 truncate rounded px-1.5 py-0.5 text-[11px] font-medium shadow-sm"
      title={`${ev.titolo}${ev.sottotitolo ? " — " + ev.sottotitolo : ""}`}
    >
      {fmtOra(ev.start)} {ev.titolo}
    </div>
  );
}

function EventoMini({ ev, onClick }: { ev: CalendarioVistaEvento; onClick: () => void }) {
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ background: ev.colore, color: "white" }}
      className="mb-0.5 truncate rounded px-1.5 py-0.5 text-[11px] font-medium shadow-sm"
      title={ev.titolo}
    >
      {ev.titolo}
    </div>
  );
}
