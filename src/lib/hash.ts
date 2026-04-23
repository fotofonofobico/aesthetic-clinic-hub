/**
 * Calcola un hash SHA-256 (esadecimale) di una stringa.
 * Usato per garantire l'integrità del consenso firmato:
 * snapshot del testo + immagine firma + timestamp.
 */
export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
