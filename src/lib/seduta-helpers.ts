import { supabase } from "@/integrations/supabase/client";
import type { ProdottoPrevisto, Seduta } from "@/types/trattamenti";

export const FINESTRA_MODIFICA_MS = 48 * 60 * 60 * 1000;

/**
 * Restituisce true se la seduta è ancora modificabile dall'operatore senza motivo audit.
 */
export function entroFinestra48h(seduta: Pick<Seduta, "firmata_il">): boolean {
  if (!seduta.firmata_il) return true;
  const firmata = new Date(seduta.firmata_il).getTime();
  return Date.now() - firmata < FINESTRA_MODIFICA_MS;
}

/**
 * Stato modificabilità della seduta per un dato utente.
 */
export interface ModificaPermesso {
  /** L'utente può aprire il dialog di modifica? */
  puoModificare: boolean;
  /** Serve obbligatoriamente compilare il motivo? */
  motivoObbligatorio: boolean;
  /** Serve essere medico? (perché oltre 48h) */
  richiedeMedico: boolean;
  /** Spiegazione human-readable */
  motivo: string;
}

export function valutaModificaSeduta(
  seduta: Pick<Seduta, "firmata_il" | "firmata_da" | "completata">,
  userId: string | undefined,
  isMedico: boolean,
): ModificaPermesso {
  if (!seduta.completata) {
    return {
      puoModificare: true,
      motivoObbligatorio: false,
      richiedeMedico: false,
      motivo: "Seduta non ancora firmata, modifica libera",
    };
  }
  const dentro = entroFinestra48h(seduta);
  if (dentro) {
    const stessoUtente = !!userId && seduta.firmata_da === userId;
    if (stessoUtente || isMedico) {
      return {
        puoModificare: true,
        motivoObbligatorio: false,
        richiedeMedico: false,
        motivo: "Modifica entro 48h: nessun motivo richiesto",
      };
    }
    return {
      puoModificare: false,
      motivoObbligatorio: false,
      richiedeMedico: false,
      motivo: "Solo chi ha firmato (o un medico) può modificare entro 48h",
    };
  }
  // Oltre 48h: serve medico + motivo
  if (!isMedico) {
    return {
      puoModificare: false,
      motivoObbligatorio: true,
      richiedeMedico: true,
      motivo: "Oltre 48h dalla firma: serve un medico per modificare",
    };
  }
  return {
    puoModificare: true,
    motivoObbligatorio: true,
    richiedeMedico: true,
    motivo: "Oltre 48h dalla firma: motivo obbligatorio (verrà registrato nell'audit)",
  };
}

/**
 * Diff di due oggetti su un set di campi noti.
 * Restituisce array di entry pronte per `seduta_modifica`.
 */
export function diffPerAudit<T extends Record<string, unknown>>(
  before: T,
  after: T,
  campi: (keyof T)[],
): Array<{ campo: string; valore_precedente: unknown; valore_nuovo: unknown }> {
  const out: Array<{ campo: string; valore_precedente: unknown; valore_nuovo: unknown }> = [];
  for (const k of campi) {
    const b = before[k];
    const a = after[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      out.push({
        campo: String(k),
        valore_precedente: (b as unknown) ?? null,
        valore_nuovo: (a as unknown) ?? null,
      });
    }
  }
  return out;
}

/**
 * Inserisce le entry di audit nella tabella seduta_modifica.
 */
export async function registraModificheSeduta(
  sedutaId: string,
  userId: string,
  delta: Array<{ campo: string; valore_precedente: unknown; valore_nuovo: unknown }>,
  motivo: string | null,
  oltre48h: boolean,
) {
  if (delta.length === 0) return;
  const rows = delta.map((d) => ({
    seduta_id: sedutaId,
    modificata_da: userId,
    campo: d.campo,
    valore_precedente: d.valore_precedente as never,
    valore_nuovo: d.valore_nuovo as never,
    motivo: motivo,
    oltre_48h: oltre48h,
  }));
  await supabase.from("seduta_modifica").insert(rows);
}

/**
 * Stato programmazione per ordinamento e badge.
 */
export type StatoSeduta = "in_ritardo" | "oggi" | "futura" | "eseguita";

export function statoSeduta(s: Pick<Seduta, "completata" | "data_seduta" | "data_esecuzione_effettiva">): StatoSeduta {
  if (s.completata) return "eseguita";
  const data = new Date(s.data_seduta);
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  const day = new Date(data);
  day.setHours(0, 0, 0, 0);
  if (day.getTime() < oggi.getTime()) return "in_ritardo";
  if (day.getTime() === oggi.getTime()) return "oggi";
  return "futura";
}

/**
 * Data clinica reale: usa data_esecuzione_effettiva se presente, altrimenti data_seduta.
 */
export function dataClinica(s: Pick<Seduta, "data_seduta" | "data_esecuzione_effettiva">): string {
  return s.data_esecuzione_effettiva ?? s.data_seduta;
}

export function formatProdotti(p: ProdottoPrevisto[]): string {
  if (!p || p.length === 0) return "—";
  return p.map((x) => `${x.nome}${x.quantita ? ` x${x.quantita}` : ""}`).join(", ");
}
