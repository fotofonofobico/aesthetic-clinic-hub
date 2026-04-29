export type CalendarioEventoTipo = "promemoria" | "follow_up" | "attivita" | "altro";

export interface EventoCalendario {
  id: string;
  titolo: string;
  descrizione: string | null;
  data_inizio: string;
  data_fine: string | null;
  tutto_il_giorno: boolean;
  tipo: CalendarioEventoTipo;
  paziente_id: string | null;
  seduta_id: string | null;
  colore: string | null;
  completato: boolean;
  sincronizza_diario: boolean;
  nota_diario_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarioPreferenze {
  user_id: string;
  followup_auto_attivo: boolean;
  followup_giorni_offset: number;
  vista_default: "settimana" | "giorno";
}

/** Evento normalizzato per la vista calendario. */
export interface CalendarioVistaEvento {
  id: string;
  source: "seduta" | "evento" | "scadenza_lotto";
  titolo: string;
  sottotitolo?: string;
  start: Date;
  end?: Date;
  tutto_il_giorno: boolean;
  colore: string;
  paziente_id?: string | null;
  paziente_nome?: string | null;
  /** dati originali per gestire click / drag */
  raw?: any;
}

export type VistaCalendario = "settimana" | "giorno";
