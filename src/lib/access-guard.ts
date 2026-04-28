import { supabase } from "@/integrations/supabase/client";
import {
  type ConsensoStatoRow,
  statoIsBlocking,
  ultimoPerCategoria,
} from "./consensi-engine";

export interface AccessEvaluation {
  bloccoTotale: boolean;
  bloccoTrattamenti: boolean;
  immaginiConsentite: boolean;
  motivi: string[];
  anamnesiStato: "draft" | "signed" | "superseded" | "missing";
  anamnesiObsoleta: boolean; // esiste draft più recente del signed
  rows: ConsensoStatoRow[];
}

export async function evaluateAccess(pazienteId: string): Promise<AccessEvaluation> {
  const [statoRes, anamRes] = await Promise.all([
    supabase.rpc("paziente_consensi_stato", { _paziente_id: pazienteId }),
    supabase
      .from("anamnesi")
      .select("stato, firmata_il, updated_at")
      .eq("paziente_id", pazienteId)
      .order("updated_at", { ascending: false }),
  ]);

  const rows = (statoRes.data ?? []) as unknown as ConsensoStatoRow[];
  const motivi: string[] = [];

  // GDPR
  const gdpr = ultimoPerCategoria(rows, "gdpr");
  let bloccoTotale = false;
  if (!gdpr) {
    bloccoTotale = true;
    motivi.push("Consenso GDPR mancante");
  } else if (gdpr.rifiutato) {
    bloccoTotale = true;
    motivi.push("GDPR rifiutato dal paziente");
  } else if (statoIsBlocking(gdpr.stato)) {
    bloccoTotale = true;
    motivi.push(`GDPR ${gdpr.stato}: richiede rifirma`);
  }

  // Uso immagini (non blocca, solo flag)
  const img = ultimoPerCategoria(rows, "uso_immagini");
  const immaginiConsentite = !!img && !img.rifiutato && !statoIsBlocking(img.stato);

  // Anamnesi (firma): basta che esista UNA riga signed per non bloccare;
  // una draft posteriore indica solo una nuova versione in lavorazione.
  const anamRows = (anamRes.data ?? []) as Array<{
    stato: "draft" | "signed" | "superseded";
    firmata_il: string | null;
    updated_at: string;
  }>;
  const signed = anamRows.find((a) => a.stato === "signed");
  const draft = anamRows.find((a) => a.stato === "draft");
  let anamnesiStato: AccessEvaluation["anamnesiStato"] = "missing";
  let anamnesiObsoleta = false;
  let bloccoTrattamenti = bloccoTotale;

  if (anamRows.length === 0) {
    anamnesiStato = "missing";
    bloccoTrattamenti = true;
    motivi.push("Anamnesi non compilata");
  } else if (signed) {
    anamnesiStato = "signed";
    if (draft) anamnesiObsoleta = true;
  } else {
    anamnesiStato = draft ? "draft" : "superseded";
    bloccoTrattamenti = true;
    motivi.push("Anamnesi non firmata");
  }

  return {
    bloccoTotale,
    bloccoTrattamenti,
    immaginiConsentite,
    motivi,
    anamnesiStato,
    anamnesiObsoleta,
    rows,
  };
}

/**
 * Verifica se un trattamento può essere eseguito: oltre ai blocchi globali,
 * controlla che esista un consenso valido per ogni template attivo collegato.
 */
export async function puoEseguireTrattamento(
  pazienteId: string,
  trattamentoId: string,
): Promise<{ ok: boolean; mancanti: Array<{ id: string; titolo: string }>; motivi: string[] }> {
  const guard = await evaluateAccess(pazienteId);
  if (guard.bloccoTotale || guard.bloccoTrattamenti) {
    return { ok: false, mancanti: [], motivi: guard.motivi };
  }

  const { data: tpls } = await supabase
    .from("consenso_template")
    .select("id, titolo")
    .eq("trattamento_id", trattamentoId)
    .eq("attivo", true);

  const richiesti = (tpls ?? []) as Array<{ id: string; titolo: string }>;
  const mancanti: Array<{ id: string; titolo: string }> = [];
  for (const t of richiesti) {
    const { data: ok } = await supabase.rpc("has_consenso_valido", {
      _paziente_id: pazienteId,
      _template_id: t.id,
    });
    if (!ok) mancanti.push(t);
  }
  if (mancanti.length > 0) {
    return {
      ok: false,
      mancanti,
      motivi: [`Consenso mancante: ${mancanti.map((m) => m.titolo).join(", ")}`],
    };
  }
  return { ok: true, mancanti: [], motivi: [] };
}
