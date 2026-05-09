import { supabase } from "@/integrations/supabase/client";
import type { ConsensoCategoria, ConsensoTemplate } from "@/types/trattamenti";
import {
  type ConsensoStatoRow,
  statoIsBlocking,
  ultimoPerCategoria,
  ultimaVersione,
  ultimaVersionePerChiave,
} from "./consensi-engine";

/**
 * Signature Session
 * -----------------
 * Orchestrazione frontend per concentrare in UN'UNICA esperienza tablet
 * tutte le firme che servono in una visita o prima di un trattamento.
 *
 * NON modifica struttura dati esistente: produce, in fase di salvataggio,
 * gli stessi record di `consenso_firmato` / `anamnesi` che si avrebbero
 * dai dialog manuali.
 */

export type SessionDocKind =
  | { kind: "gdpr"; templateId: string }
  | { kind: "uso_immagini"; templateId: string }
  | { kind: "anamnesi"; anamnesiId: string; versioneNumero: number }
  | {
      kind: "trattamento";
      templateId: string;
      trattamentoId: string;
      categoria: Extract<ConsensoCategoria, "trattamento_singolo" | "trattamento_ciclo">;
    };

export interface SessionDoc {
  /** id locale della sessione (uuid client-side) */
  localId: string;
  kind: SessionDocKind;
  titolo: string;
  testo: string;
  versione: string;
  validitaMesi: number | null;
  durataTipo: "mesi" | "sedute";
  duratSedute: number | null;
  richiedeFirmaMedico: boolean;
  /** runtime — popolati durante il flusso */
  scelta?: "acconsento" | "non_acconsento";
  firmaPaziente?: string | null;
  firmaMedico?: string | null;
  completato: boolean;
}

export type SessionTipo = "visita" | "trattamento";

export interface SignatureSession {
  tipo: SessionTipo;
  pazienteId: string;
  trattamentiSelezionati?: string[];
  documenti: SessionDoc[];
}

function uid(): string {
  return crypto.randomUUID();
}

function makeDoc(
  kind: SessionDocKind,
  partial: {
    titolo: string;
    testo: string;
    versione: string;
    validitaMesi: number | null;
    durataTipo?: "mesi" | "sedute";
    duratSedute?: number | null;
    richiedeFirmaMedico: boolean;
  },
): SessionDoc {
  return {
    localId: uid(),
    kind,
    completato: false,
    durataTipo: "mesi",
    duratSedute: null,
    ...partial,
  };
}

/**
 * Costruisce la sessione di firma legata a una VISITA.
 * Include solo i documenti effettivamente mancanti / scaduti / da rinnovare.
 * Ordine: GDPR → Uso immagini → Anamnesi.
 */
export async function buildVisitaSession(
  pazienteId: string,
): Promise<SignatureSession | null> {
  const [statoRes, anamRes, tplRes] = await Promise.all([
    supabase.rpc("paziente_consensi_stato", { _paziente_id: pazienteId }),
    supabase
      .from("anamnesi")
      .select(
        "id, stato, versione_numero, updated_at, firmata_il, generale, patologica, farmacologica, estetica, note_libere",
      )
      .eq("paziente_id", pazienteId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("consenso_template")
      .select("*")
      .eq("attivo", true)
      .in("categoria", ["gdpr", "uso_immagini"]),
  ]);

  const rows = (statoRes.data ?? []) as unknown as ConsensoStatoRow[];
  const templates = (tplRes.data ?? []) as ConsensoTemplate[];

  const docs: SessionDoc[] = [];

  // 1) GDPR — solo l'ultima versione attiva
  const gdprTpl = ultimaVersione(templates.filter((t) => t.categoria === "gdpr"));
  const ultimoGdpr = ultimoPerCategoria(rows, "gdpr");
  const gdprNeeded =
    !ultimoGdpr ||
    ultimoGdpr.rifiutato ||
    statoIsBlocking(ultimoGdpr.stato) ||
    (gdprTpl && ultimoGdpr.versione !== gdprTpl.versione);
  if (gdprNeeded && gdprTpl) {
    docs.push(
      makeDoc(
        { kind: "gdpr", templateId: gdprTpl.id },
        {
          titolo: gdprTpl.titolo,
          testo: gdprTpl.testo,
          versione: gdprTpl.versione,
          validitaMesi: gdprTpl.validita_mesi,
          richiedeFirmaMedico: gdprTpl.richiede_firma_medico,
        },
      ),
    );
  }

  // 2) Uso immagini — solo l'ultima versione attiva
  const imgTpl = ultimaVersione(templates.filter((t) => t.categoria === "uso_immagini"));
  const ultimoImg = ultimoPerCategoria(rows, "uso_immagini");
  const imgNeeded =
    !ultimoImg ||
    statoIsBlocking(ultimoImg.stato) ||
    (imgTpl && ultimoImg.versione !== imgTpl.versione);
  if (imgNeeded && imgTpl) {
    docs.push(
      makeDoc(
        { kind: "uso_immagini", templateId: imgTpl.id },
        {
          titolo: imgTpl.titolo,
          testo: imgTpl.testo,
          versione: imgTpl.versione,
          validitaMesi: imgTpl.validita_mesi,
          richiedeFirmaMedico: imgTpl.richiede_firma_medico,
        },
      ),
    );
  }

  // 3) Anamnesi: serve firma se ultima è draft (o esiste un draft più recente di una signed)
  const anamRows =
    (anamRes.data ?? []) as Array<{
      id: string;
      stato: "draft" | "signed" | "superseded";
      versione_numero: number;
      updated_at: string;
      firmata_il: string | null;
      generale: Record<string, unknown> | null;
      patologica: Record<string, unknown> | null;
      farmacologica: Record<string, unknown> | null;
      estetica: Record<string, unknown> | null;
      note_libere: string | null;
    }>;
  const draftCorrente = anamRows.find((a) => a.stato === "draft");
  if (draftCorrente) {
    const riassunto = buildAnamnesiRiassunto(draftCorrente);
    docs.push(
      makeDoc(
        {
          kind: "anamnesi",
          anamnesiId: draftCorrente.id,
          versioneNumero: draftCorrente.versione_numero,
        },
        {
          titolo: `Anamnesi v${draftCorrente.versione_numero}`,
          testo:
            riassunto +
            "\n\n— — —\nConfermo la veridicità delle informazioni anamnestiche fornite e autorizzo il trattamento dei dati clinici per le finalità mediche.",
          versione: String(draftCorrente.versione_numero),
          validitaMesi: null,
          richiedeFirmaMedico: false,
        },
      ),
    );
  }

  if (docs.length === 0) return null;
  return { tipo: "visita", pazienteId, documenti: docs };
}

/**
 * Produce un riassunto testuale leggibile delle sezioni anamnesi compilate.
 * Mostra solo i campi valorizzati per non confondere il paziente.
 */
function buildAnamnesiRiassunto(row: {
  generale: Record<string, unknown> | null;
  patologica: Record<string, unknown> | null;
  farmacologica: Record<string, unknown> | null;
  estetica: Record<string, unknown> | null;
  note_libere: string | null;
}): string {
  const parts: string[] = [];

  function fmtVal(v: unknown): string | null {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "boolean") return v ? "Sì" : "No";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return v;
    return null;
  }

  function dumpSection(titolo: string, obj: Record<string, unknown> | null) {
    if (!obj) return;
    const righe: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const val = fmtVal(v);
      if (val === null) continue;
      // skip valori "false" booleani per non riempire di "No"
      if (typeof v === "boolean" && v === false) continue;
      const label = k.replace(/_/g, " ");
      righe.push(`  • ${label}: ${val}`);
    }
    if (righe.length > 0) {
      parts.push(`${titolo}:\n${righe.join("\n")}`);
    }
  }

  dumpSection("Generale", row.generale);
  dumpSection("Patologica", row.patologica);
  dumpSection("Farmacologica", row.farmacologica);
  dumpSection("Estetica", row.estetica);
  if (row.note_libere && row.note_libere.trim()) {
    parts.push(`Note libere:\n  ${row.note_libere.trim()}`);
  }

  if (parts.length === 0) {
    return "Nessuna informazione anamnestica significativa registrata.";
  }
  return "RIASSUNTO ANAMNESI\n\n" + parts.join("\n\n");
}

/**
 * Costruisce la sessione di firma per ESEGUIRE uno o più trattamenti.
 * Salta i consensi già validi e le sedute in cicli attivi.
 */
export async function buildTrattamentoSession(
  pazienteId: string,
  trattamentoIds: string[],
): Promise<SignatureSession | null> {
  if (trattamentoIds.length === 0) return null;

  const tplRes = await supabase
    .from("consenso_template")
    .select("*")
    .eq("attivo", true)
    .in("trattamento_id", trattamentoIds);

  const allTemplates = (tplRes.data ?? []) as ConsensoTemplate[];
  // Per ogni (trattamento_id + categoria) tieni solo l'ultima versione attiva.
  const templates = ultimaVersionePerChiave(
    allTemplates,
    (t) => `${t.trattamento_id ?? ""}::${t.categoria}`,
  );
  if (templates.length === 0) {
    return { tipo: "trattamento", pazienteId, trattamentiSelezionati: trattamentoIds, documenti: [] };
  }

  const docs: SessionDoc[] = [];
  const seenTpl = new Set<string>();

  for (const tpl of templates) {
    if (seenTpl.has(tpl.id)) continue;
    if (!tpl.trattamento_id) continue;
    // Skip se già valido
    const { data: ok } = await supabase.rpc("has_consenso_valido", {
      _paziente_id: pazienteId,
      _template_id: tpl.id,
    });
    if (ok) continue;

    const cat: ConsensoCategoria = tpl.categoria;
    if (cat !== "trattamento_singolo" && cat !== "trattamento_ciclo") continue;

    docs.push(
      makeDoc(
        {
          kind: "trattamento",
          templateId: tpl.id,
          trattamentoId: tpl.trattamento_id,
          categoria: cat,
        },
        {
          titolo: tpl.titolo,
          testo: tpl.testo,
          versione: tpl.versione,
          validitaMesi:
            tpl.durata_tipo === "sedute"
              ? null
              : tpl.validita_mesi ?? (cat === "trattamento_ciclo" ? 12 : null),
          durataTipo: tpl.durata_tipo === "sedute" ? "sedute" : "mesi",
          duratSedute: tpl.durata_tipo === "sedute" ? tpl.durata_sedute : null,
          richiedeFirmaMedico: tpl.richiede_firma_medico,
        },
      ),
    );
    seenTpl.add(tpl.id);
  }

  return {
    tipo: "trattamento",
    pazienteId,
    trattamentiSelezionati: trattamentoIds,
    documenti: docs,
  };
}

export function calcolaValidoFinoA(
  doc: SessionDoc,
  firmatoIl: Date,
): string | null {
  // Ciclo a sedute: nessuna scadenza temporale, gestita dal contatore sedute
  if (doc.kind.kind === "trattamento" && doc.kind.categoria === "trattamento_ciclo"
      && doc.durataTipo === "sedute") {
    return null;
  }
  if (doc.kind.kind === "trattamento" && doc.kind.categoria === "trattamento_ciclo") {
    const mesi = doc.validitaMesi && doc.validitaMesi > 0 ? doc.validitaMesi : 12;
    const d = new Date(firmatoIl);
    d.setMonth(d.getMonth() + mesi);
    return d.toISOString();
  }
  if (doc.validitaMesi && doc.validitaMesi > 0) {
    const d = new Date(firmatoIl);
    d.setMonth(d.getMonth() + doc.validitaMesi);
    return d.toISOString();
  }
  return null;
}
