export type PianoStato = "attivo" | "completato" | "sospeso" | "annullato";

export type ConsensoCategoria =
  | "gdpr"
  | "uso_immagini"
  | "anamnesi"
  | "trattamento_singolo"
  | "trattamento_ciclo"
  | "altro";

export type ConsensoModalitaFirma = "tablet" | "pdf_caricato";

export type ConsensoStato =
  | "valid"
  | "expiring"
  | "expired"
  | "obsolete"
  | "revoked"
  | "rifiutato"
  | "missing";

export const CATEGORIA_LABELS: Record<ConsensoCategoria, string> = {
  gdpr: "GDPR / Privacy",
  uso_immagini: "Uso immagini",
  anamnesi: "Anamnesi",
  trattamento_singolo: "Trattamento singolo",
  trattamento_ciclo: "Ciclo di trattamento",
  altro: "Altro",
};

export const CATEGORIA_VALIDITA_DEFAULT: Record<ConsensoCategoria, number | null> = {
  gdpr: null,
  uso_immagini: null,
  anamnesi: null,
  trattamento_singolo: null,
  trattamento_ciclo: 12,
  altro: null,
};

export type TrattamentoTipo = "singolo" | "ciclo";
export type DurataUnita = "giorni" | "settimane" | "mesi";

export const TRATTAMENTO_CATEGORIE = [
  "tossina_botulinica",
  "filler",
  "biostimolazione",
  "peeling",
  "device",
  "altro",
] as const;
export type TrattamentoCategoria = (typeof TRATTAMENTO_CATEGORIE)[number];

export const TRATTAMENTO_CATEGORIA_LABELS: Record<TrattamentoCategoria, string> = {
  tossina_botulinica: "Tossina botulinica",
  filler: "Filler",
  biostimolazione: "Biostimolazione",
  peeling: "Peeling",
  device: "Device",
  altro: "Altro",
};

export const DURATA_UNITA_LABELS: Record<DurataUnita, string> = {
  giorni: "Giorni",
  settimane: "Settimane",
  mesi: "Mesi",
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
  tipo: TrattamentoTipo | null;
  durata_ciclo_valore: number | null;
  durata_ciclo_unita: DurataUnita | null;
  consenso_template_id: string | null;
}

export type ConsensoDurataTipo = "mesi" | "sedute";

export interface ConsensoTemplate {
  id: string;
  trattamento_id: string | null;
  titolo: string;
  testo: string;
  versione: string;
  categoria: ConsensoCategoria;
  validita_mesi: number | null;
  durata_tipo: ConsensoDurataTipo;
  durata_sedute: number | null;
  descrizione: string | null;
  richiede_firma_medico: boolean;
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
  durata_tipo_snapshot: ConsensoDurataTipo;
  durata_sedute_snapshot: number | null;
  sedute_max_snapshot: number | null;
  sedute_consumate: number;
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
  rifiutato: boolean;
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

export type ScontoTipo = "nessuno" | "euro" | "percento";

export interface PianoTrattamento {
  id: string;
  paziente_id: string;
  trattamento_id: string | null;
  titolo: string;
  numero_sedute_previste: number;
  prezzo_totale: number | null;
  prezzo_finale: number | null;
  sconto_tipo: ScontoTipo;
  sconto_valore: number;
  stato: PianoStato;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProdottoPrevisto {
  nome: string;
  quantita: number;
  trattamento_id?: string | null;
  prodotto_id?: string | null;
}

export interface PianoVoce {
  id: string;
  piano_id: string;
  trattamento_id: string;
  pacchetto_id: string | null;
  numero_sedute: number;
  prezzo_unitario: number;
  prezzo_riga: number;
  ordine: number;
  prodotti_previsti: ProdottoPrevisto[];
  /** Quando valorizzato, contiene un array di array (uno per seduta) di prodotti.
   *  Se NULL, viene replicata `prodotti_previsti` su ogni seduta. */
  prodotti_per_seduta: ProdottoPrevisto[][] | null;
  zone: string[];
  created_at: string;
}

export interface Seduta {
  id: string;
  piano_id: string | null;
  paziente_id: string;
  numero_seduta: number;
  /** Data prevista / programmata della seduta. NULL = "data da definire". */
  data_seduta: string | null;
  /** Data clinica reale (può essere retroattiva) */
  data_esecuzione_effettiva: string | null;
  /** Quando l'operatore l'ha registrata nel sistema */
  data_registrazione: string;
  durata_minuti: number | null;
  operatore_id: string | null;
  parametri_tecnici: Record<string, unknown>;
  note_cliniche: string | null;
  completata: boolean;
  firmata_il: string | null;
  firmata_da: string | null;
  nota_diario_id: string | null;
  trattamento_id?: string | null;
  voce_id?: string | null;
  prodotti_previsti: ProdottoPrevisto[];
  zone?: string[];
  created_at: string;
  updated_at: string;
}

export interface SedutaModifica {
  id: string;
  seduta_id: string;
  modificata_da: string;
  modificata_il: string;
  campo: string;
  valore_precedente: unknown;
  valore_nuovo: unknown;
  motivo: string | null;
  oltre_48h: boolean;
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
