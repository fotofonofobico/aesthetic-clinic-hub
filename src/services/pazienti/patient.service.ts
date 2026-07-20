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
  NuovoAlertInput,
} from "./patient.types";

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  critico: 3,
  attenzione: 2,
  info: 1,
};

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

  if (error) {
    logger.error("[patientService.listPazienti]", error);
    throw new Error("Errore caricamento pazienti");
  }

  const ids = (pData ?? []).map((p) => p.id);
  let flagsByPaziente: Record<string, AlertSeverity[]> = {};
  if (ids.length > 0) {
    const { data: flags, error: flagsError } = await supabase
      .from("anamnesi_flag_rischio")
      .select("paziente_id, severity")
      .in("paziente_id", ids);

    if (flagsError) {
      logger.error("[patientService.listPazienti:flags]", flagsError);
      throw new Error("Errore caricamento pazienti");
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

/** Ripristina un paziente precedentemente archiviato (soft delete). */
export async function restorePaziente(id: string): Promise<void> {
  const { error } = await supabase
    .from("pazienti")
    .update({ deleted_at: null, deleted_by: null })
    .eq("id", id);

  if (error) {
    logger.error("[patientService.restorePaziente]", error);
    throw new Error(error.message);
  }
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

  if (pRes.error || !pRes.data) {
    if (pRes.error) logger.error("[patientService.getPazienteDetail]", pRes.error);
    throw new Error("Paziente non trovato");
  }
  if (aRes.error) {
    logger.error("[patientService.getPazienteDetail:alerts]", aRes.error);
    throw new Error("Errore caricamento alert paziente");
  }
  if (fRes.error) {
    logger.error("[patientService.getPazienteDetail:flags]", fRes.error);
    throw new Error("Errore caricamento flag di rischio paziente");
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
    logger.error("[patientService.getConsensiPianoMancanti]", err);
    return [];
  }
}

/** Aggiunge un alert clinico manuale al paziente. */
export async function addPazienteAlert(input: NuovoAlertInput): Promise<void> {
  const { error } = await supabase.from("paziente_alert").insert({
    paziente_id: input.pazienteId,
    testo: input.testo,
    severity: input.severity,
    created_by: input.createdBy,
  });

  if (error) {
    logger.error("[patientService.addPazienteAlert]", error);
    throw new Error(error.message);
  }
}

/** Disattiva (soft) un alert clinico manuale. */
export async function deactivatePazienteAlert(id: string): Promise<void> {
  const { error } = await supabase.from("paziente_alert").update({ attivo: false }).eq("id", id);

  if (error) {
    logger.error("[patientService.deactivatePazienteAlert]", error);
    throw new Error(error.message);
  }
}

/**
 * Registra la visualizzazione della scheda paziente ai fini di audit.
 * Non bloccante: eventuali errori vengono solo loggati (comportamento
 * preesistente, mantenuto temporaneamente nel PatientService).
 */
export async function logPazienteAccess(pazienteId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("paziente_access_log")
    .insert({ paziente_id: pazienteId, user_id: userId, azione: "view" });

  if (error) {
    logger.error("[patientService.logPazienteAccess]", error);
  }
}
