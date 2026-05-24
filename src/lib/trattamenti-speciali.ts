/**
 * Riconoscimento "trattamenti speciali" tramite nome.
 * Voluto frontend-only: nessun campo DB nuovo, modificabile a piacere.
 */

export function isTrattamentoCriolipolisi(nome: string | null | undefined): boolean {
  if (!nome) return false;
  return nome.trim().toLowerCase().startsWith("criolipolisi");
}

/**
 * Riconosce una "visita" (prima visita o visita di controllo).
 * Usato per:
 *  - proporre lo storno della visita pagata quando si crea un piano successivo;
 *  - non scalarla più di una volta (flag `scalata_in_piano_id` sulla seduta).
 */
export function isTrattamentoVisita(nome: string | null | undefined): boolean {
  if (!nome) return false;
  const n = nome.trim().toLowerCase();
  return n.startsWith("prima visita") || n.startsWith("visita");
}
