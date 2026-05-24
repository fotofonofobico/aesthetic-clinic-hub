import type { Trattamento } from "@/types/trattamenti";

export type ScontoTipo = "nessuno" | "euro" | "percento";

/**
 * Prezzo riga: per i cicli, il prezzo indicativo rappresenta l'intero ciclo
 * e va contato una sola volta indipendentemente dalle sedute. Per i singoli,
 * si moltiplica per il numero di sedute.
 */
export function prezzoRiga(
  trattamento: Trattamento | undefined,
  numeroSedute: number,
): number {
  if (!trattamento) return 0;
  const prezzo = trattamento.prezzo_indicativo ?? 0;
  if (trattamento.tipo === "ciclo") return Math.round(prezzo * 100) / 100;
  return Math.round(prezzo * Math.max(0, numeroSedute) * 100) / 100;
}

export function calcolaTotaleRighe(
  righe: { trattamento_id: string; numero_sedute: number }[],
  trattamenti: Trattamento[],
): number {
  let tot = 0;
  for (const r of righe) {
    const t = trattamenti.find((x) => x.id === r.trattamento_id);
    tot += prezzoRiga(t, r.numero_sedute);
  }
  return Math.round(tot * 100) / 100;
}

export function applicaSconto(
  totale: number,
  tipo: ScontoTipo,
  valore: number,
): { sconto: number; finale: number } {
  if (tipo === "nessuno" || !valore || valore <= 0) {
    return { sconto: 0, finale: totale };
  }
  let sconto = 0;
  if (tipo === "euro") sconto = Math.min(totale, valore);
  else if (tipo === "percento") sconto = (totale * Math.min(100, valore)) / 100;
  const finale = Math.max(0, totale - sconto);
  return {
    sconto: Math.round(sconto * 100) / 100,
    finale: Math.round(finale * 100) / 100,
  };
}

export function formatEuro(n: number | null | undefined): string {
  const v = typeof n === "number" ? n : 0;
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(v);
}

/**
 * Calcolo completo del totale del piano con supporto a:
 *  - prezzo pacchetto fisso (override della somma righe)
 *  - sconto globale (euro o percento)
 *  - storno di una visita già pagata (riga negativa)
 *
 * Tutti i campi sono opzionali: senza override / sconto / storno
 * il risultato coincide con il vecchio `applicaSconto(calcolaTotaleRighe(...))`.
 */
export interface CalcoloPianoCompleto {
  /** Somma delle righe (sempre, anche con override) — per mostrare il "risparmio". */
  subtotaleRighe: number;
  /** Base di calcolo: override se presente, altrimenti subtotaleRighe. */
  base: number;
  /** Sconto effettivo applicato in euro. */
  sconto: number;
  /** Storno visita effettivo applicato in euro. */
  storno: number;
  /** Totale finale (mai negativo). */
  finale: number;
}

export function calcolaTotalePiano(args: {
  righe: { trattamento_id: string; numero_sedute: number }[];
  trattamenti: Trattamento[];
  override: number | null;
  scontoTipo: ScontoTipo;
  scontoValore: number;
  stornoVisita: number;
}): CalcoloPianoCompleto {
  const subtotaleRighe = calcolaTotaleRighe(args.righe, args.trattamenti);
  const base =
    typeof args.override === "number" && args.override >= 0
      ? Math.round(args.override * 100) / 100
      : subtotaleRighe;
  const { sconto, finale: dopoSconto } = applicaSconto(
    base,
    args.scontoTipo,
    args.scontoValore,
  );
  const storno = Math.max(0, Math.min(dopoSconto, args.stornoVisita || 0));
  const finale = Math.max(0, dopoSconto - storno);
  return {
    subtotaleRighe,
    base,
    sconto,
    storno: Math.round(storno * 100) / 100,
    finale: Math.round(finale * 100) / 100,
  };
}

