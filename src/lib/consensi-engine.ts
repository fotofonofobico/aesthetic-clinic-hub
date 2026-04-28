import type { ConsensoCategoria, ConsensoStato } from "@/types/trattamenti";

export interface ConsensoStatoRow {
  consenso_id: string;
  template_id: string | null;
  titolo: string;
  versione: string;
  categoria: ConsensoCategoria;
  firmato_il: string;
  valido_fino_a: string | null;
  rifiutato: boolean;
  stato: ConsensoStato;
}

export const STATO_BADGE: Record<ConsensoStato, { label: string; cls: string }> = {
  valid: {
    label: "Valido",
    cls: "border-success/40 bg-success/15 text-success-foreground",
  },
  expiring: {
    label: "In scadenza",
    cls: "border-warning/40 bg-warning/15",
  },
  expired: {
    label: "Scaduto",
    cls: "border-warning/40 bg-warning/15",
  },
  obsolete: {
    label: "Obsoleto",
    cls: "border-muted-foreground/40 bg-muted text-muted-foreground",
  },
  revoked: {
    label: "Revocato",
    cls: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  rifiutato: {
    label: "Rifiutato",
    cls: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  missing: {
    label: "Mancante",
    cls: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

export function statoIsBlocking(s: ConsensoStato): boolean {
  return s !== "valid" && s !== "expiring";
}

/**
 * Restituisce l'ultimo consenso (più recente) per ogni categoria/template combinato.
 */
export function ultimoPerTemplate(rows: ConsensoStatoRow[]): Map<string, ConsensoStatoRow> {
  const map = new Map<string, ConsensoStatoRow>();
  // rows già ordinati DESC dalla RPC
  for (const r of rows) {
    const key = r.template_id ?? `cat:${r.categoria}`;
    if (!map.has(key)) map.set(key, r);
  }
  return map;
}

/**
 * Restituisce l'ultimo per categoria (utile per GDPR/uso_immagini/anamnesi).
 */
export function ultimoPerCategoria(
  rows: ConsensoStatoRow[],
  categoria: ConsensoCategoria,
): ConsensoStatoRow | null {
  for (const r of rows) {
    if (r.categoria === categoria) return r;
  }
  return null;
}
