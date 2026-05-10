/**
 * Funzione di salvataggio condivisa per le sessioni firma.
 * Estratta da SignatureSessionDialog per essere riutilizzata anche dalla
 * finalizzazione "Modalità tablet" sul Mac.
 */
import { supabase } from "@/integrations/supabase/client";
import { sha256Hex } from "@/lib/hash";
import { generaPdfConsenso } from "@/lib/pdf-consenso";
import { generaPdfAnamnesi } from "@/lib/pdf-anamnesi";
import { calcolaValidoFinoA, type SessionDoc, type SignatureSession } from "@/lib/signature-session";

export interface SaveContext {
  userId: string | null;
  operatoreNome: string | null;
  modalitaFirma: "tablet" | "pdf_caricato";
}

export async function caricaPazientePerFirma(pazienteId: string) {
  const { data, error } = await supabase
    .from("pazienti")
    .select("nome, cognome, data_nascita, codice_fiscale")
    .eq("id", pazienteId)
    .single();
  if (error || !data) throw new Error("Errore caricamento paziente");
  return data;
}

export async function caricaOperatoreNome(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("nome, cognome")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return `${data.cognome ?? ""} ${data.nome ?? ""}`.trim() || null;
}

/**
 * Salva tutti i documenti di una sessione firma. Genera PDF, hash, inserimenti
 * in consenso_firmato e update di anamnesi rispettando la pipeline esistente.
 * In caso di errore esegue rollback degli insert e remove dei file caricati.
 */
export async function salvaSessioneFirme(
  session: SignatureSession,
  finalDocs: SessionDoc[],
  ctx: SaveContext,
): Promise<void> {
  const paz = await caricaPazientePerFirma(session.pazienteId);
  const insertedConsensi: string[] = [];
  const uploadedPaths: string[] = [];
  const firmatoIl = new Date();

  try {
    for (const doc of finalDocs) {
      if (!doc.completato) continue;

      if (doc.kind.kind === "anamnesi") {
        if (doc.scelta === "non_acconsento") continue;
        if (!doc.firmaPaziente) continue;

        // Carica il payload reale dell'anamnesi così il PDF non risulta vuoto.
        const { data: anamRow } = await supabase
          .from("anamnesi")
          .select("generale, patologica, farmacologica, estetica, note_libere")
          .eq("id", doc.kind.anamnesiId)
          .single();

        const { blob, hash } = await generaPdfAnamnesi({
          paziente: {
            nome: paz.nome,
            cognome: paz.cognome,
            codice_fiscale: paz.codice_fiscale ?? null,
            data_nascita: paz.data_nascita ?? null,
          },
          versioneNumero: doc.kind.versioneNumero,
          firmataIl: firmatoIl,
          payload: {
            generale: (anamRow?.generale ?? null) as Record<string, unknown> | null,
            patologica: (anamRow?.patologica ?? null) as Record<string, unknown> | null,
            farmacologica: (anamRow?.farmacologica ?? null) as Record<string, unknown> | null,
            estetica: (anamRow?.estetica ?? null) as Record<string, unknown> | null,
            note_libere: (anamRow?.note_libere ?? null) as string | null,
          },
          firmaPazienteDataUrl: doc.firmaPaziente,
          firmaMedicoDataUrl: doc.firmaMedico ?? null,
          operatoreNome: ctx.operatoreNome,
        });

        const path = `${session.pazienteId}/${doc.kind.anamnesiId}-v${doc.kind.versioneNumero}.pdf`;
        const up = await supabase.storage
          .from("anamnesi-pdf")
          .upload(path, blob, { contentType: "application/pdf", upsert: true });
        if (up.error || !up.data?.path) {
          throw new Error(`Upload PDF anamnesi fallito: ${up.error?.message ?? "path vuoto"}`);
        }
        uploadedPaths.push(`anamnesi-pdf:${path}`);

        const upd = await supabase
          .from("anamnesi")
          .update({
            stato: "signed",
            firmata_il: firmatoIl.toISOString(),
            firmata_da_medico: ctx.userId,
            firma_paziente: doc.firmaPaziente,
            firma_medico: doc.firmaMedico ?? null,
            hash_integrita: hash,
            pdf_url: path,
          })
          .eq("id", doc.kind.anamnesiId);
        if (upd.error) throw upd.error;
      } else {
        const categoria = doc.kind.kind === "trattamento" ? doc.kind.categoria : doc.kind.kind;
        const validoFinoA =
          doc.scelta === "acconsento" ? calcolaValidoFinoA(doc, firmatoIl) : null;

        const { blob, hash } = await generaPdfConsenso({
          paziente: {
            nome: paz.nome,
            cognome: paz.cognome,
            data_nascita: paz.data_nascita ?? null,
            codice_fiscale: paz.codice_fiscale ?? null,
          },
          titolo: doc.titolo,
          testo: doc.testo,
          versione: doc.versione,
          categoria,
          firmatoIl,
          validoFinoA: validoFinoA ? new Date(validoFinoA) : null,
          modalitaFirma: ctx.modalitaFirma,
          firmaPazienteDataUrl: doc.firmaPaziente ?? null,
          firmaMedicoDataUrl: doc.firmaMedico ?? null,
          operatoreNome: ctx.operatoreNome,
          rifiutato: doc.scelta === "non_acconsento",
          note: null,
        });
        const pdfPath = `${session.pazienteId}/sessione/${Date.now()}-${doc.localId}.pdf`;
        const up = await supabase.storage
          .from("consensi-pdf")
          .upload(pdfPath, blob, { contentType: "application/pdf" });
        if (up.error || !up.data?.path) {
          throw new Error(`Upload PDF consenso fallito: ${up.error?.message ?? "path vuoto"}`);
        }
        uploadedPaths.push(`consensi-pdf:${pdfPath}`);

        const integrita = await sha256Hex(
          `${doc.titolo}|${doc.testo}|${doc.versione}|${firmatoIl.toISOString()}|${
            doc.firmaPaziente?.length ?? 0
          }|${doc.scelta}|${hash}`,
        );

        const insertPayload: Record<string, unknown> = {
          paziente_id: session.pazienteId,
          template_id: doc.kind.templateId,
          titolo_snapshot: doc.titolo,
          testo_snapshot: doc.testo,
          versione_snapshot: doc.versione,
          categoria_snapshot: categoria,
          validita_mesi_snapshot: doc.validitaMesi,
          durata_tipo_snapshot: doc.durataTipo,
          durata_sedute_snapshot: doc.duratSedute,
          sedute_max_snapshot: doc.durataTipo === "sedute" ? doc.duratSedute : null,
          modalita_firma: ctx.modalitaFirma,
          firma_immagine: doc.firmaPaziente ?? null,
          firma_medico_immagine: doc.firmaMedico ?? null,
          pdf_url: pdfPath,
          firmato_il: firmatoIl.toISOString(),
          valido_fino_a: validoFinoA,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
          operatore_testimone: ctx.userId,
          firmato_da_medico: doc.firmaMedico ? ctx.userId : null,
          hash_integrita: integrita,
          rifiutato: doc.scelta === "non_acconsento",
          note: null,
        };

        const ins = await supabase
          .from("consenso_firmato")
          .insert(insertPayload as never)
          .select("id")
          .single();
        if (ins.error) throw ins.error;
        if (ins.data?.id) insertedConsensi.push(ins.data.id);
      }
    }
  } catch (e) {
    if (insertedConsensi.length > 0) {
      await supabase.from("consenso_firmato").delete().in("id", insertedConsensi);
    }
    for (const p of uploadedPaths) {
      const [bucket, ...rest] = p.split(":");
      const path = rest.join(":");
      await supabase.storage.from(bucket).remove([path]);
    }
    throw e;
  }
}
