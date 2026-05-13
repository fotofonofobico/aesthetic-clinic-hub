/**
 * Riconoscimento "trattamenti speciali" tramite nome.
 * Voluto frontend-only: nessun campo DB nuovo, modificabile a piacere.
 */

export function isTrattamentoCriolipolisi(nome: string | null | undefined): boolean {
  if (!nome) return false;
  return nome.trim().toLowerCase().startsWith("criolipolisi");
}
