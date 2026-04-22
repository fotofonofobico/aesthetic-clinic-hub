export type AlertSeverity = "info" | "attenzione" | "critico";
export type Sesso = "M" | "F" | "altro";

export interface Paziente {
  id: string;
  nome: string;
  cognome: string;
  sesso: Sesso | null;
  data_nascita: string | null;
  luogo_nascita: string | null;
  codice_fiscale: string | null;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  provincia: string | null;
  professione: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PazienteAlert {
  id: string;
  paziente_id: string;
  testo: string;
  severity: AlertSeverity;
  attivo: boolean;
  created_at: string;
}

export interface FlagRischio {
  id: string;
  paziente_id: string;
  codice: string;
  etichetta: string;
  severity: AlertSeverity;
  origine: string;
  created_at: string;
}
