export type ModalitaTracking = "tracciato" | "solo_uso" | "standby";

export type MovimentoTipo =
  | "carico"
  | "scarico"
  | "rettifica_pos"
  | "rettifica_neg"
  | "scarto_scadenza";

export const MODALITA_LABELS: Record<ModalitaTracking, string> = {
  tracciato: "Tracciato",
  solo_uso: "Solo uso",
  standby: "Standby",
};

export const MODALITA_DESCRIZIONI: Record<ModalitaTracking, string> = {
  tracciato: "Conta scorte e scarica automaticamente",
  solo_uso: "Registra lotto/uso senza decremento (prodotti condivisi)",
  standby: "Disattivato — escluso da seduta e piano",
};

export const MOVIMENTO_LABELS: Record<MovimentoTipo, string> = {
  carico: "Carico",
  scarico: "Scarico",
  rettifica_pos: "Rettifica +",
  rettifica_neg: "Rettifica −",
  scarto_scadenza: "Scarto",
};

export interface Marca {
  id: string;
  nome: string;
  attiva: boolean;
  created_at: string;
}

export interface Fornitore {
  id: string;
  nome: string;
  contatti: { email?: string; telefono?: string; note?: string };
  attivo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Prodotto {
  id: string;
  nome: string;
  tipologia: string | null;
  marca_id: string | null;
  fornitore_id: string | null;
  unita_misura: string;
  costo_unitario_default: number | null;
  soglia_minima: number;
  modalita_tracking: ModalitaTracking;
  attivo: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lotto {
  id: string;
  prodotto_id: string;
  numero_lotto: string;
  data_scadenza: string | null;
  quantita_iniziale: number;
  quantita_disponibile: number;
  costo_unitario: number | null;
  note: string | null;
  created_at: string;
}

export interface Movimento {
  id: string;
  prodotto_id: string;
  lotto_id: string | null;
  tipo: MovimentoTipo;
  quantita: number;
  costo_unitario: number | null;
  seduta_id: string | null;
  paziente_id: string | null;
  operatore_id: string | null;
  note: string | null;
  motivazione: string | null;
  modalita_snapshot: ModalitaTracking | null;
  data_movimento: string;
}

export interface ProdottoConDettagli extends Prodotto {
  marca?: Marca | null;
  fornitore?: Fornitore | null;
  qta_totale?: number;
  num_lotti?: number;
  lotto_min_scadenza?: string | null;
}

export interface RigaConsumo {
  prodotto_id: string;
  lotto_id?: string | null;
  quantita: number;
  /** Per creazione lotto inline (solo se lotto_id non specificato) */
  nuovo_lotto?: { numero_lotto: string; data_scadenza?: string | null; costo?: number | null } | null;
}

export function statoLotto(l: Lotto, sogliaProdotto: number): "esaurito" | "scaduto" | "scadenza_vicina" | "sotto_soglia" | "ok" {
  if (l.quantita_disponibile <= 0) return "esaurito";
  if (l.data_scadenza) {
    const scad = new Date(l.data_scadenza);
    const now = new Date();
    const diff = (scad.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (diff < 0) return "scaduto";
    if (diff < 30) return "scadenza_vicina";
  }
  if (sogliaProdotto > 0 && l.quantita_disponibile <= sogliaProdotto) return "sotto_soglia";
  return "ok";
}
