import { useMutation, useQuery } from "@tanstack/react-query";
import * as patientService from "@/services/pazienti/patient.service";

/** Lista pazienti (attivi o archiviati) per la pagina elenco. */
export function usePazientiList(mostraArchiviati: boolean) {
  return useQuery({
    queryKey: ["pazienti", "list", mostraArchiviati],
    queryFn: () => patientService.listPazienti(mostraArchiviati),
  });
}

/** Dati di dettaglio (anagrafica, alert, flag rischio) per la pagina scheda paziente. */
export function usePazienteDetail(id: string, options: { enabled: boolean }) {
  return useQuery({
    queryKey: ["pazienti", "detail", id],
    queryFn: () => patientService.getPazienteDetail(id),
    enabled: options.enabled,
  });
}

/** Nomi trattamento con consenso mancante tra i piani attivi del paziente (soluzione temporanea). */
export function useConsensiPianoMancanti(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["pazienti", "consensi-piano-mancanti", id],
    queryFn: () => patientService.getConsensiPianoMancanti(id),
    enabled,
  });
}

/** Registra la visualizzazione della scheda paziente ai fini di audit (non bloccante). */
export function useLogPazienteAccess() {
  return useMutation({
    mutationFn: (input: { pazienteId: string; userId: string }) =>
      patientService.logPazienteAccess(input.pazienteId, input.userId),
  });
}
