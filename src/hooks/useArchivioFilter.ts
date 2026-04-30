import { useState, useCallback } from "react";

/**
 * Helper condiviso per liste di catalogo (prodotti, trattamenti, consensi).
 * - mostraArchiviati: stato del toggle "Mostra archiviati"
 * - filterRow: filtra una riga in base al campo `archiviato_il`
 *   (passare la riga: se ha `archiviato_il` non null, viene mostrata solo se mostraArchiviati=true)
 */
export function useArchivioFilter(initial = false) {
  const [mostraArchiviati, setMostraArchiviati] = useState(initial);

  const toggle = useCallback(() => setMostraArchiviati((v) => !v), []);

  const filterRow = useCallback(
    (row: { archiviato_il?: string | null } | null | undefined): boolean => {
      if (!row) return false;
      if (mostraArchiviati) return true;
      return row.archiviato_il == null;
    },
    [mostraArchiviati],
  );

  return { mostraArchiviati, setMostraArchiviati, toggle, filterRow };
}
