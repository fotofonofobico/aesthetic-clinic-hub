export type PianoStato = "attivo" | "completato" | "sospeso" | "annullato";

export interface Trattamento {
  id: string;
  nome: string;
  categoria: string | null;
  descrizione: string | null;
  durata_minuti: number | null;
  prezzo_indicativo: number | null;
  attivo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConsensoTemplate {
  id: string;
  trattamento_id: string | null;
  titolo: string;
  testo: string;
  versione: string;
  attivo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConsensoFirmato {
  id: string;
  paziente_id: string;
  template_id: string | null;
  titolo_snapshot: string;
  testo_snapshot: string;
  versione_snapshot: string;
  firma_immagine: string;
  firmato_il: string;
  ip_dispositivo: string | null;
  user_agent: string | null;
  operatore_testimone: string | null;
  hash_integrita: string | null;
  note: string | null;
  created_at: string;
}

export interface PianoTrattamento {
  id: string;
  paziente_id: string;
  trattamento_id: string | null;
  titolo: string;
  numero_sedute_previste: number;
  prezzo_totale: number | null;
  stato: PianoStato;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Seduta {
  id: string;
  piano_id: string;
  paziente_id: string;
  numero_seduta: number;
  data_seduta: string;
  durata_minuti: number | null;
  operatore_id: string | null;
  parametri_tecnici: Record<string, unknown>;
  note_cliniche: string | null;
  completata: boolean;
  created_at: string;
  updated_at: string;
}

export interface Followup {
  id: string;
  seduta_id: string;
  paziente_id: string;
  data_followup: string;
  esito: string | null;
  foto: unknown[];
  note: string | null;
  complicanza_segnalata: boolean;
  complicanza_descrizione: string | null;
  created_at: string;
  updated_at: string;
}
