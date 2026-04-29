/**
 * Firma sessione "remota" (Mac → iPad)
 * --------------------------------------
 * Il Mac costruisce una SignatureSession (struttura esistente in
 * lib/signature-session) e la "delega" a un dispositivo tablet via la
 * tabella firma_sessione. L'iPad la legge, mostra il SignatureSessionDialog
 * normale e, alla conferma del paziente, invece di scrivere su
 * consenso_firmato/anamnesi, registra scelte+firma nella sessione.
 * Il Mac riceve l'evento via Realtime, recupera scelte+firma e completa
 * il salvataggio (firme medico incluse) usando la pipeline esistente.
 */
import { supabase } from "@/integrations/supabase/client";
import type { SignatureSession, SessionDoc } from "@/lib/signature-session";
import { useEffect, useState } from "react";

export type FirmaSessioneStato =
  | "waiting"
  | "pending"
  | "signed"
  | "refused"
  | "expired"
  | "cancelled";

/** Risposta del paziente per ciascun documento, salvata sulla sessione. */
export interface RispostaDocumento {
  localId: string;
  scelta: "acconsento" | "non_acconsento";
  firmaPaziente: string | null;
}

export interface PayloadSessione {
  tipo: "visita" | "trattamento";
  documenti: SessionDoc[]; // snapshot doc da mostrare
  pazienteNome: string;
  pazienteId: string;
}

export interface FirmaSessioneRow {
  id: string;
  tipo: "consenso" | "anamnesi";
  target_id: string;
  paziente_id: string;
  payload: PayloadSessione & { risposte?: RispostaDocumento[] };
  stato: FirmaSessioneStato;
  firma_paziente_base64: string | null;
  acconsensi: { risposte?: RispostaDocumento[] } | null;
  rifiuto_motivo: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  signed_at: string | null;
  consumed_at: string | null;
  consumed_into_id: string | null;
}

/** Crea una nuova sessione delegata sul tablet. */
export async function creaFirmaSessione(
  session: SignatureSession,
  pazienteNome: string,
  userId: string,
): Promise<{ id: string } | { error: string }> {
  // Tipo "consenso" se ci sono documenti consenso, altrimenti "anamnesi".
  // target_id = primo doc (puramente indicativo, il payload contiene tutto).
  const isAnamnesi =
    session.documenti.length === 1 && session.documenti[0]?.kind.kind === "anamnesi";
  const firstDoc = session.documenti[0];
  if (!firstDoc) return { error: "Nessun documento da firmare" };

  let targetId = "";
  switch (firstDoc.kind.kind) {
    case "anamnesi":
      targetId = firstDoc.kind.anamnesiId;
      break;
    case "gdpr":
    case "uso_immagini":
    case "trattamento":
      targetId = firstDoc.kind.templateId;
      break;
  }

  const payload: PayloadSessione = {
    tipo: session.tipo,
    documenti: session.documenti,
    pazienteNome,
    pazienteId: session.pazienteId,
  };

  const { data, error } = await supabase
    .from("firma_sessione")
    .insert({
      tipo: isAnamnesi ? "anamnesi" : "consenso",
      target_id: targetId,
      paziente_id: session.pazienteId,
      payload: payload as never,
      stato: "pending",
      created_by: userId,
    } as never)
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: (data as { id: string }).id };
}

export async function annullaFirmaSessione(id: string): Promise<void> {
  await supabase
    .from("firma_sessione")
    .update({ stato: "cancelled" } as never)
    .eq("id", id);
}

/** L'iPad chiama questa quando il paziente conferma le scelte e firma. */
export async function salvaRispostePaziente(
  id: string,
  risposte: RispostaDocumento[],
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("firma_sessione")
    .update({
      stato: "signed",
      acconsensi: { risposte } as never,
      signed_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
  return error ? { error: error.message } : {};
}

export async function rifiutaFirmaSessione(
  id: string,
  motivo: string,
): Promise<void> {
  await supabase
    .from("firma_sessione")
    .update({
      stato: "refused",
      rifiuto_motivo: motivo,
      signed_at: new Date().toISOString(),
    } as never)
    .eq("id", id);
}

export async function marcaConsumed(id: string, consumedIntoId?: string): Promise<void> {
  await supabase
    .from("firma_sessione")
    .update({
      consumed_at: new Date().toISOString(),
      consumed_into_id: consumedIntoId ?? null,
    } as never)
    .eq("id", id);
}

/** Hook: osserva una singola sessione via Realtime. */
export function useFirmaSessione(id: string | null) {
  const [row, setRow] = useState<FirmaSessioneRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setRow(null);
      return;
    }
    let active = true;
    setLoading(true);
    void supabase
      .from("firma_sessione")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setRow((data as unknown as FirmaSessioneRow | null) ?? null);
          setLoading(false);
        }
      });

    const ch = supabase
      .channel(`firma_sessione:${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "firma_sessione", filter: `id=eq.${id}` },
        (payload) => {
          setRow(payload.new as FirmaSessioneRow);
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(ch);
    };
  }, [id]);

  return { row, loading };
}

/** Hook: tablet ascolta in tempo reale le sessioni "pending" non scadute per un creatore. */
export function useSessioniInArrivo(createdBy: string | null) {
  const [rows, setRows] = useState<FirmaSessioneRow[]>([]);

  useEffect(() => {
    if (!createdBy) return;
    let active = true;

    async function reload() {
      const { data } = await supabase
        .from("firma_sessione")
        .select("*")
        .eq("created_by", createdBy)
        .in("stato", ["pending", "waiting"])
        .is("consumed_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (active) setRows((data ?? []) as FirmaSessioneRow[]);
    }
    void reload();

    const ch = supabase
      .channel(`firma_sessione:incoming:${createdBy}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "firma_sessione", filter: `created_by=eq.${createdBy}` },
        () => {
          void reload();
        },
      )
      .subscribe();

    const interval = setInterval(reload, 30_000); // refresh per scadenze

    return () => {
      active = false;
      clearInterval(interval);
      void supabase.removeChannel(ch);
    };
  }, [createdBy]);

  return rows;
}
