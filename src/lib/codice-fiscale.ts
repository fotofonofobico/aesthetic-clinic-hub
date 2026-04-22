/**
 * Validatore formale del codice fiscale italiano.
 * Verifica formato (16 caratteri, struttura) e carattere di controllo.
 */
const ODD_MAP: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21,
  K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14,
  U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

const EVEN_MAP: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9,
  K: 10, L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17, S: 18, T: 19,
  U: 20, V: 21, W: 22, X: 23, Y: 24, Z: 25,
};

const CHECK_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function normalizeCF(cf: string): string {
  return cf.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidCFFormat(cf: string): boolean {
  return /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(cf);
}

export function isValidCF(cf: string): boolean {
  if (!cf) return false;
  const normalized = normalizeCF(cf);
  if (!isValidCFFormat(normalized)) return false;

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const ch = normalized[i];
    sum += i % 2 === 0 ? ODD_MAP[ch] : EVEN_MAP[ch];
  }
  const expected = CHECK_CHARS[sum % 26];
  return expected === normalized[15];
}

export function validateCFInput(cf: string | null | undefined): {
  ok: boolean;
  message?: string;
} {
  if (!cf || cf.trim() === "") return { ok: true };
  const normalized = normalizeCF(cf);
  if (!isValidCFFormat(normalized)) {
    return { ok: false, message: "Formato CF non valido (16 caratteri)" };
  }
  if (!isValidCF(normalized)) {
    return { ok: false, message: "Codice fiscale non valido (carattere di controllo errato)" };
  }
  return { ok: true };
}
