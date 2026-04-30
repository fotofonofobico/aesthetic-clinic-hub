export type AlertSeverity = "info" | "attenzione" | "critico";
export type Sesso = "M" | "F" | "altro";
export type NotaTipo = "clinica" | "telefonata" | "promemoria" | "altro";

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
  // Campi non più usati nel form attuale ma presenti a DB:
  identita_genere: string | null;
  peso_kg: number | null;
  altezza_cm: number | null;
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

export interface NotaAllegato {
  path: string;
  nome: string;
  mime?: string | null;
  size?: number | null;
}

export interface PazienteNota {
  id: string;
  paziente_id: string;
  tipo: NotaTipo;
  testo: string;
  data_evento: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  allegati?: NotaAllegato[] | null;
}

export interface AnamnesiVersione {
  id: string;
  anamnesi_id: string;
  paziente_id: string;
  snapshot: unknown;
  created_at: string;
  created_by: string | null;
}
