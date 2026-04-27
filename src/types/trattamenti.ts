export type PianoStato = "attivo" | "completato" | "sospeso" | "annullato";

export type ConsensoCategoria =
  | "gdpr_generale"
  | "trattamento_singolo"
  | "trattamento_continuativo"
  | "altro";

export type ConsensoModalitaFirma = "tablet" | "pdf_caricato";

export type ConsensoStato = "valido" | "scaduto" | "obsoleto" | "revocato";

export const CATEGORIA_LABELS: Record<ConsensoCategoria, string> = {
  gdpr_generale: "GDPR / Privacy",
  trattamento_singolo: "Trattamento singolo",
  trattamento_continuativo: "Trattamento continuativo",
  altro: "Altro",
};

export const CATEGORIA_VALIDITA_DEFAULT: Record<ConsensoCategoria, number | null> = {
  gdpr_generale: null, // fino a revoca/aggiornamento
  trattamento_singolo: null, // valido per la singola seduta
  trattamento_continuativo: 12,
  altro: null,
};

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
  categoria: ConsensoCategoria;
  validita_mesi: number | null;
  descrizione: string | null;
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
  categoria_snapshot: ConsensoCategoria;
  validita_mesi_snapshot: number | null;
  modalita_firma: ConsensoModalitaFirma;
  firma_immagine: string | null;
  pdf_url: string | null;
  firmato_il: string;
  valido_fino_a: string | null;
  revocato_il: string | null;
  revocato_da: string | null;
  ip_dispositivo: string | null;
  user_agent: string | null;
  operatore_testimone: string | null;
  hash_integrita: string | null;
  note: string | null;
  created_at: string;
}

export interface ConsensoStatoRow {
  consenso_id: string;
  template_id: string | null;
  titolo: string;
  versione: string;
  categoria: ConsensoCategoria;
  firmato_il: string;
  valido_fino_a: string | null;
  stato: ConsensoStato;
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
