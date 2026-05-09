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

/**
 * Confronta due stringhe versione tipo "1.0" / "1.10" in ordine numerico.
 * Ritorna un numero compatibile con Array.sort.
 */
export function compareVersioni(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Da una lista di template/oggetti versionati, restituisce solo l'elemento
 * con la versione più alta (tie-break su `updated_at` se presente).
 * Se la lista è vuota ritorna null.
 */
export function ultimaVersione<
  T extends { versione: string; updated_at?: string | null },
>(list: T[]): T | null {
  if (list.length === 0) return null;
  return [...list].sort((a, b) => {
    const v = compareVersioni(b.versione, a.versione);
    if (v !== 0) return v;
    const au = a.updated_at ?? "";
    const bu = b.updated_at ?? "";
    return bu.localeCompare(au);
  })[0];
}

/**
 * Raggruppa per chiave e per ciascun gruppo tiene solo l'ultima versione.
 */
export function ultimaVersionePerChiave<
  T extends { versione: string; updated_at?: string | null },
>(list: T[], keyFn: (item: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const item of list) {
    const key = keyFn(item);
    const arr = groups.get(key) ?? [];
    arr.push(item);
    groups.set(key, arr);
  }
  const out: T[] = [];
  for (const arr of groups.values()) {
    const latest = ultimaVersione(arr);
    if (latest) out.push(latest);
  }
  return out;
}
