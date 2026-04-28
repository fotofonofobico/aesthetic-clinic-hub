import type { Trattamento } from "@/types/trattamenti";

export interface TrattamentoPacchetto {
  id: string;
  trattamento_id: string;
  nome: string;
  numero_sedute: number;
  prezzo_pacchetto: number;
  attivo: boolean;
  created_at: string;
  updated_at: string;
}

export interface VocePiano {
  id?: string;
  trattamento_id: string;
  pacchetto_id: string | null;
  numero_sedute: number;
  prezzo_unitario: number;
  prezzo_riga: number;
  ordine: number;
}

export interface CalcoloPiano {
  voci: VocePiano[];
  subtotale: number;
  sconto: number;
  totale: number;
}

/**
 * Calcola il prezzo di una voce: se ha un pacchetto associato usa il prezzo pacchetto,
 * altrimenti prezzo_unitario * numero_sedute.
 */
export function calcolaVoce(
  trattamento: Trattamento,
  pacchetto: TrattamentoPacchetto | null,
  numeroSedute: number,
): { prezzoUnitario: number; prezzoRiga: number } {
  if (pacchetto && pacchetto.numero_sedute === numeroSedute) {
    return {
      prezzoUnitario: pacchetto.prezzo_pacchetto / Math.max(1, numeroSedute),
      prezzoRiga: pacchetto.prezzo_pacchetto,
    };
  }
  const u = trattamento.prezzo_indicativo ?? 0;
  return { prezzoUnitario: u, prezzoRiga: u * numeroSedute };
}

/**
 * Suggerisce automaticamente il pacchetto più conveniente per un dato numero di sedute.
 */
export function suggerisciPacchetto(
  pacchetti: TrattamentoPacchetto[],
  trattamentoId: string,
  numeroSedute: number,
): TrattamentoPacchetto | null {
  const candidati = pacchetti.filter(
    (p) => p.trattamento_id === trattamentoId && p.attivo && p.numero_sedute === numeroSedute,
  );
  if (candidati.length === 0) return null;
  return candidati.sort((a, b) => a.prezzo_pacchetto - b.prezzo_pacchetto)[0];
}

export function calcolaPiano(voci: VocePiano[], sconto = 0): CalcoloPiano {
  const subtotale = voci.reduce((s, v) => s + (v.prezzo_riga ?? 0), 0);
  const totale = Math.max(0, subtotale - (sconto || 0));
  return { voci, subtotale, sconto: sconto || 0, totale };
}

export function titoloAutomatico(
  voci: Array<{ trattamento_id: string }>,
  trattamenti: Trattamento[],
): string {
  if (voci.length === 0) return "Nuovo piano";
  const nomi = voci
    .map((v) => trattamenti.find((t) => t.id === v.trattamento_id)?.nome)
    .filter(Boolean) as string[];
  if (nomi.length === 1) return `Piano ${nomi[0]}`;
  if (nomi.length <= 3) return `Piano ${nomi.join(" + ")}`;
  return `Piano ${nomi.slice(0, 2).join(" + ")} + altri`;
}
