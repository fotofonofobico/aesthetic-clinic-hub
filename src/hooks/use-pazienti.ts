import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as patientService from "@/services/pazienti/patient.service";
import type { NuovoAlertInput } from "@/services/pazienti/patient.types";

/** Lista pazienti (attivi o archiviati) per la pagina elenco. */
export function usePazientiList(mostraArchiviati: boolean) {
  return useQuery({
    queryKey: ["pazienti", "list", mostraArchiviati],
    queryFn: () => patientService.listPazienti(mostraArchiviati),
  });
}

/** Ripristina un paziente archiviato e invalida la lista pazienti. */
export function useRestorePaziente() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => patientService.restorePaziente(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pazienti", "list"] });
    },
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

/** Aggiunge un alert clinico manuale al paziente. */
export function useAddPazienteAlert() {
  return useMutation({
    mutationFn: (input: NuovoAlertInput) => patientService.addPazienteAlert(input),
  });
}

/** Disattiva un alert clinico manuale del paziente. */
export function useDeactivatePazienteAlert() {
  return useMutation({
    mutationFn: (id: string) => patientService.deactivatePazienteAlert(id),
  });
}

/** Registra la visualizzazione della scheda paziente ai fini di audit (non bloccante). */
export function useLogPazienteAccess() {
  return useMutation({
    mutationFn: (input: { pazienteId: string; userId: string }) =>
      patientService.logPazienteAccess(input.pazienteId, input.userId),
  });
}
