export type FotoMomento = "prima" | "dopo";
export type FotoLivello = "piano" | "seduta";

export type PianoFotoStato = "completo" | "baseline_mancante" | "non_eseguibile";

export const PIANO_FOTO_STATO_LABELS: Record<PianoFotoStato, string> = {
  completo: "Completo",
  baseline_mancante: "Foto PRIMA mancante",
  non_eseguibile: "Non eseguibile",
};

export interface FotoClinica {
  id: string;
  paziente_id: string;
  piano_id: string;
  seduta_id: string | null;
  momento: FotoMomento;
  livello: FotoLivello;
  zona: string | null;
  storage_path: string;
  data_scatto: string; // ISO date
  data_caricamento: string;
  note: string | null;
  created_by: string | null;
}

export interface PianoFotoStatoRow {
  piano_id: string;
  stato: PianoFotoStato;
  motivazione: string | null;
  incoerenza_data: boolean;
  cambiato_da: string | null;
  cambiato_il: string;
}
