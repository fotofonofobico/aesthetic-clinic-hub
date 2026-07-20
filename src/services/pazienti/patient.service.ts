import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { puoEseguireTrattamento } from "@/lib/access-guard";
import type {
  Paziente,
  PazienteAlert,
  FlagRischio,
  AlertSeverity,
  PazienteConSeverity,
  PazienteDetailData,
} from "./patient.types";

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critico: 3,
  attenzione: 2,
  info: 1,
};

/**
 * Log centralizzato per gli errori del Service Layer Pazienti (TASK 002).
 * Unico punto di logging per query principali e accessorie: label sintetica
 * + oggetto errore, mai payload paziente (vedi regola d'uso in lib/logger.ts).
 */
function logServiceError(label: string, error: unknown): void {
  logger.error(label, error);
}

/**
 * Verifica l'esito di una query "principale": se in errore, logga e
 * interrompe l'operazione. Da usare solo per la risorsa il cui fallimento
 * deve invalidare l'intera lettura (non per query accessorie).
 */
function assertNoError(label: string, error: unknown, message: string): void {
  if (error) {
    logServiceError(label, error);
    throw new Error(message);
  }
}

/**
 * Lista pazienti (esclusi/archiviati in base a `mostraArchiviati`), arricchita
 * con la severity massima dei flag di rischio anamnesi per riga.
 */
export async function listPazienti(mostraArchiviati: boolean): Promise<PazienteConSeverity[]> {
  const { data: pData, error } = await supabase
    .from("pazienti")
    .select("*")
    .filter("deleted_at", mostraArchiviati ? "not.is" : "is", null)
    .order("cognome", { ascending: true });

  assertNoError("[patientService.listPazienti]", error, "Errore caricamento pazienti");

  const ids = (pData ?? []).map((p) => p.id);
  let flagsByPaziente: Record<string, AlertSeverity[]> = {};
  if (ids.length > 0) {
    const { data: flags, error: flagsError } = await supabase
      .from("anamnesi_flag_rischio")
      .select("paziente_id, severity")
      .in("paziente_id", ids);

    // Query accessoria: un suo fallimento non deve compromettere la lista
    // principale, degrada a nessun flag di rischio (comportamento originale).
    if (flagsError) {
      logServiceError("[patientService.listPazienti:flags]", flagsError);
    }

    flagsByPaziente = (flags ?? []).reduce<Record<string, AlertSeverity[]>>((acc, f) => {
      (acc[f.paziente_id] ??= []).push(f.severity as AlertSeverity);
      return acc;
    }, {});
  }

  return (pData ?? []).map((p) => {
    const sev = flagsByPaziente[p.id] ?? [];
    const max = sev.sort((a, b) => SEVERITY_ORDER[b] - SEVERITY_ORDER[a])[0] ?? null;
    return { ...(p as Paziente), max_severity: max };
  });
}

/** Dati completi per la pagina di dettaglio paziente: anagrafica, alert manuali attivi, flag di rischio. */
export async function getPazienteDetail(id: string): Promise<PazienteDetailData> {
  const [pRes, aRes, fRes] = await Promise.all([
    supabase.from("pazienti").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("paziente_alert")
      .select("*")
      .eq("paziente_id", id)
      .eq("attivo", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("anamnesi_flag_rischio")
      .select("*")
      .eq("paziente_id", id)
      .order("severity", { ascending: false }),
  ]);

  // Query principale: solo il suo fallimento interrompe l'operazione.
  if (pRes.error) logServiceError("[patientService.getPazienteDetail]", pRes.error);
  if (pRes.error || !pRes.data) {
    throw new Error("Paziente non trovato");
  }

  // Query accessorie: un loro fallimento non deve compromettere il recupero
  // del paziente, degradano ai valori di default (comportamento originale).
  if (aRes.error) {
    logServiceError("[patientService.getPazienteDetail:alerts]", aRes.error);
  }
  if (fRes.error) {
    logServiceError("[patientService.getPazienteDetail:flags]", fRes.error);
  }

  return {
    paziente: pRes.data as Paziente,
    alerts: (aRes.data ?? []) as PazienteAlert[],
    flags: (fRes.data ?? []) as FlagRischio[],
  };
}

/**
 * Elenco nomi trattamento con consenso mancante tra i piani attivi del paziente.
 *
 * Soluzione temporanea: interroga direttamente le tabelle Piani/Trattamenti
 * (non ancora coperte da un proprio Service Layer) per eliminare l'accesso
 * diretto a Supabase dalla route di dettaglio paziente. Non introduce un
 * modello di dominio Piani/Trattamenti: quando quel dominio avrà un service
 * dedicato, questa funzione andrà spostata/rimossa.
 *
 * Non blocca il rendering della pagina: eventuali errori vengono loggati e
 * risolti con lista vuota, replicando il comportamento preesistente.
 */
export async function getConsensiPianoMancanti(pazienteId: string): Promise<string[]> {
  try {
    const { data: piani, error: pianiError } = await supabase
      .from("piano_trattamento")
      .select("id, stato")
      .eq("paziente_id", pazienteId)
      .not("stato", "in", "(annullato,bozza)");
    if (pianiError) throw pianiError;

    const pianoIds = (piani ?? []).map((p) => (p as { id: string }).id);
    if (pianoIds.length === 0) return [];

    const { data: voci, error: vociError } = await supabase
      .from("piano_trattamento_voce")
      .select("trattamento_id")
      .in("piano_id", pianoIds);
    if (vociError) throw vociError;

    const trattamentoIds = Array.from(
      new Set(
        (voci ?? [])
          .map((v) => (v as { trattamento_id: string | null }).trattamento_id)
          .filter((x): x is string => !!x),
      ),
    );
    if (trattamentoIds.length === 0) return [];

    const { data: trattRows, error: trattError } = await supabase
      .from("trattamenti")
      .select("id, nome")
      .in("id", trattamentoIds);
    if (trattError) throw trattError;

    const nameMap = new Map<string, string>(
      (trattRows ?? []).map((t) => [(t as { id: string }).id, (t as { nome: string }).nome]),
    );

    const mancanti: string[] = [];
    await Promise.all(
      trattamentoIds.map(async (tid) => {
        const res = await puoEseguireTrattamento(pazienteId, tid);
        if (!res.ok) mancanti.push(nameMap.get(tid) ?? "Trattamento");
      }),
    );
    return mancanti.sort();
  } catch (err) {
    logServiceError("[patientService.getConsensiPianoMancanti]", err);
    return [];
  }
}

/**
 * Registra la visualizzazione della scheda paziente ai fini di audit.
 * Non bloccante: eventuali errori vengono solo loggati.
 *
 * Eccezione infrastrutturale al perimetro read-only di TASK 001 v1.1:
 * non è una mutation di dominio Pazienti ma logging tecnico di audit,
 * per questo resta nel Service Layer anche in questa fase.
 */
export async function logPazienteAccess(pazienteId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("paziente_access_log")
    .insert({ paziente_id: pazienteId, user_id: userId, azione: "view" });

  if (error) {
    logger.error("[patientService.logPazienteAccess]", error);
  }
}
