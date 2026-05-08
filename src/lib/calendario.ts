import type { CalendarioEventoTipo, CalendarioVistaEvento } from "@/types/calendario";

export const TIPO_LABEL: Record<CalendarioEventoTipo, string> = {
  promemoria: "Promemoria",
  follow_up: "Follow-up",
  attivita: "Attività",
  altro: "Altro",
};

export const TIPO_COLORE: Record<CalendarioEventoTipo, string> = {
  promemoria: "hsl(262 83% 58%)",
  follow_up: "hsl(280 70% 55%)",
  attivita: "hsl(250 75% 60%)",
  altro: "hsl(var(--muted-foreground))",
};

/** Colore unico usato come "pallino Eventi" nei filtri/legenda */
export const COLORE_EVENTO = "hsl(262 83% 58%)";

export const COLORE_SEDUTA = "hsl(217 91% 60%)"; // blu
export const COLORE_SCADENZA = "hsl(38 92% 50%)"; // ambra

export function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // lun=0
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function fmtOra(d: Date): string {
  return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function fmtData(d: Date): string {
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export function fmtDataLunga(d: Date): string {
  return d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Ordina eventi per data. */
export function ordinaEventi(eventi: CalendarioVistaEvento[]): CalendarioVistaEvento[] {
  return [...eventi].sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Filtra eventi del giorno specifico. */
export function eventiDelGiorno(
  eventi: CalendarioVistaEvento[],
  giorno: Date,
): CalendarioVistaEvento[] {
  const start = startOfDay(giorno).getTime();
  const end = endOfDay(giorno).getTime();
  return eventi.filter((e) => {
    const t = e.start.getTime();
    return t >= start && t <= end;
  });
}

/** Genera datetime locale formato input datetime-local. */
export function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): Date {
  return new Date(v);
}
