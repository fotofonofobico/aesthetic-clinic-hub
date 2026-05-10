import { jsPDF } from "jspdf";
import { sha256Hex } from "./hash";
import type { DatiPazientePdf } from "./pdf-consenso";
import {
  renderFooterPagine,
  renderHeaderPaziente,
  renderMetadata,
  renderSignatureBlock,
} from "./pdf-template";

export interface AnamnesiPdfInput {
  paziente: DatiPazientePdf;
  versioneNumero: number;
  firmataIl: Date;
  payload: {
    generale: Record<string, unknown> | null;
    patologica: Record<string, unknown> | null;
    farmacologica: Record<string, unknown> | null;
    estetica: Record<string, unknown> | null;
    note_libere: string | null;
  };
  /** null = stampa senza firma (workflow cartaceo) */
  firmaPazienteDataUrl: string | null;
  firmaMedicoDataUrl: string | null;
  operatoreNome: string | null;
  /** "cartaceo" se generato per stampa/firma manuale */
  modalita?: "tablet" | "cartaceo";
}

type FieldType = "bool" | "ternary" | "text" | "number" | "enum";

interface FieldDef {
  k: string;
  l: string;
  type: FieldType;
  /** opzionale: chiave del campo "note" associato (mostrato solo se valorizzato) */
  noteKey?: string;
  /** opzionale: mappa enum value → label */
  enumLabels?: Record<string, string>;
}

const TERNARY_LABELS: Record<string, string> = {
  si: "Sì",
  no: "No",
  occasionale: "Occasionale",
};

const SECTIONS: { sectionKey: "generale" | "patologica" | "farmacologica" | "estetica"; title: string; fields: FieldDef[] }[] = [
  {
    sectionKey: "generale",
    title: "1. Generale",
    fields: [
      { k: "allergie", l: "Allergie", type: "bool", noteKey: "allergie_note" },
      { k: "lidocaina_sensibile", l: "Sensibilità lidocaina", type: "bool" },
      { k: "fumo", l: "Fumo", type: "ternary" },
      { k: "alcol", l: "Alcol", type: "ternary" },
      { k: "caffe", l: "Caffè", type: "ternary" },
      { k: "sport", l: "Sport", type: "bool", noteKey: "sport_note" },
      {
        k: "alimentazione",
        l: "Alimentazione",
        type: "enum",
        enumLabels: {
          sana: "Sana ed equilibrata",
          abbastanza: "Abbastanza equilibrata",
          disequilibrata: "Disequilibrata",
        },
      },
      { k: "acqua_litri", l: "Acqua (litri/die)", type: "number" },
      {
        k: "condizioni_ormonali",
        l: "Condizioni ormonali",
        type: "enum",
        enumLabels: {
          nessuna: "Nessuna",
          gravidanza: "Gravidanza",
          allattamento: "Allattamento",
          menopausa: "Menopausa",
        },
      },
      { k: "vaccino_recente", l: "Vaccino recente", type: "bool", noteKey: "vaccino_note" },
    ],
  },
  {
    sectionKey: "patologica",
    title: "2. Patologica",
    fields: [
      { k: "diabete", l: "Diabete", type: "bool" },
      { k: "ipertensione", l: "Ipertensione", type: "bool" },
      { k: "tiroide", l: "Patologie tiroidee", type: "bool" },
      { k: "cardiopatia", l: "Cardiopatie", type: "bool" },
      { k: "varici", l: "Varici arti inferiori", type: "bool" },
      { k: "coagulopatia", l: "Coagulopatie / patologie ematologiche", type: "bool" },
      { k: "asma_bpco", l: "Asma / BPCO", type: "bool" },
      { k: "oncologico_attivo", l: "Oncologico attivo", type: "bool" },
      { k: "neoplasia_pregressa", l: "Neoplasia pregressa", type: "bool" },
      { k: "autoimmune", l: "Malattie autoimmuni", type: "bool" },
      { k: "cheloidi", l: "Cheloidi", type: "bool" },
      { k: "dermatopatie", l: "Dermatopatie", type: "bool" },
      { k: "hsv", l: "HSV (Herpes simplex)", type: "bool" },
      { k: "altro", l: "Altro patologie", type: "bool", noteKey: "altro_note" },
      { k: "interventi", l: "Interventi pregressi", type: "bool", noteKey: "interventi_altro_note" },
    ],
  },
  {
    sectionKey: "farmacologica",
    title: "3. Farmacologica",
    fields: [
      { k: "anticoagulanti", l: "Anticoagulante / antiaggregante", type: "bool" },
      { k: "cortisonici", l: "Cortisonica in corso", type: "bool" },
      { k: "isotretinoina", l: "Isotretinoina ultimi 6 mesi", type: "bool" },
      { k: "immunosoppressori", l: "Immunosoppressiva", type: "bool" },
      { k: "integratori", l: "Integratori / omeopatici", type: "bool" },
      { k: "altro", l: "Altri farmaci", type: "bool", noteKey: "altro_note" },
    ],
  },
  {
    sectionKey: "estetica",
    title: "4. Estetica",
    fields: [
      {
        k: "fototipo",
        l: "Fototipo",
        type: "enum",
        enumLabels: { I: "I", II: "II", III: "III", IV: "IV", V: "V", VI: "VI" },
      },
      {
        k: "texture",
        l: "Texture cutanea",
        type: "enum",
        enumLabels: {
          omogenea: "Omogenea",
          parziale: "Parziale",
          disomogenea: "Disomogenea",
        },
      },
      { k: "abbronzatura", l: "Abbronzatura attiva", type: "bool" },
      { k: "elastosi", l: "Elastosi solare", type: "bool" },
      { k: "spf_uso", l: "Uso SPF", type: "bool" },
      {
        k: "trattamenti_pregressi",
        l: "Trattamenti estetici pregressi",
        type: "bool",
        noteKey: "trattamenti_pregressi_note",
      },
      {
        k: "reazioni_pregresse",
        l: "Reazioni avverse pregresse",
        type: "bool",
        noteKey: "reazioni_pregresse_note",
      },
    ],
  },
];

function formatField(def: FieldDef, raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "Non compilato";
  switch (def.type) {
    case "bool":
      return raw ? "Sì" : "No";
    case "ternary":
      return TERNARY_LABELS[String(raw)] ?? "Non compilato";
    case "enum":
      return def.enumLabels?.[String(raw)] ?? String(raw);
    case "number":
      return typeof raw === "number" ? String(raw) : String(raw);
    case "text":
    default:
      return String(raw);
  }
}

function renderSection(
  doc: jsPDF,
  title: string,
  data: Record<string, unknown> | null,
  fields: FieldDef[],
  startY: number,
  margin: number,
  pageW: number,
  pageH: number,
): number {
  let y = startY;
  if (y > pageH - 80) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(title, margin, y);
  y += 14;
  doc.setFont("helvetica", "normal").setFontSize(9);

  const src = data ?? {};
  for (const f of fields) {
    if (y > pageH - 60) {
      doc.addPage();
      y = margin;
    }
    const value = formatField(f, (src as Record<string, unknown>)[f.k]);
    const labelW = 200;
    doc.setFont("helvetica", "bold").setTextColor(60);
    const wrappedLabel = doc.splitTextToSize(`${f.l}:`, labelW - 6) as string[];
    doc.text(wrappedLabel[0], margin, y);
    doc.setFont("helvetica", "normal").setTextColor(0);
    const wrappedVal = doc.splitTextToSize(value, pageW - margin * 2 - labelW) as string[];
    doc.text(wrappedVal, margin + labelW, y);
    const lines = Math.max(wrappedLabel.length, wrappedVal.length);
    y += 12 * lines;

    // Nota associata (es. allergie_note) solo se valorizzata
    if (f.noteKey) {
      const note = (src as Record<string, unknown>)[f.noteKey];
      if (note !== null && note !== undefined && String(note).trim() !== "") {
        if (y > pageH - 60) {
          doc.addPage();
          y = margin;
        }
        const noteLines = doc.splitTextToSize(
          `   Note: ${String(note)}`,
          pageW - margin * 2,
        ) as string[];
        doc.setTextColor(80);
        for (const l of noteLines) {
          doc.text(l, margin, y);
          y += 11;
        }
        doc.setTextColor(0);
      }
    }
  }
  return y + 8;
}

export async function generaPdfAnamnesi(
  input: AnamnesiPdfInput,
): Promise<{ blob: Blob; hash: string }> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;
  const modalita = input.modalita ?? "tablet";

  // Titolo
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text("ANAMNESI", margin, y);
  y += 22;

  // 1. HEADER paziente
  y = renderHeaderPaziente(doc, input.paziente, margin, y);

  // 2. METADATA
  y = renderMetadata(
    doc,
    {
      tipoDocumento: "Anamnesi clinica",
      titolo: `Anamnesi v${input.versioneNumero}`,
      versione: String(input.versioneNumero),
      firmatoIl: modalita === "cartaceo" ? null : input.firmataIl,
    },
    margin,
    y,
  );

  // 3. CONTENUTO
  y = renderSection(doc, "1. Generale", input.payload.generale, y, margin, pageW, pageH);
  y = renderSection(doc, "2. Patologica", input.payload.patologica, y, margin, pageW, pageH);
  y = renderSection(doc, "3. Farmacologica", input.payload.farmacologica, y, margin, pageW, pageH);
  y = renderSection(doc, "4. Estetica", input.payload.estetica, y, margin, pageW, pageH);

  if (input.payload.note_libere) {
    if (y > pageH - 80) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text("Note libere", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal").setFontSize(9);
    const lines = doc.splitTextToSize(input.payload.note_libere, pageW - margin * 2);
    for (const l of lines as string[]) {
      if (y > pageH - 60) {
        doc.addPage();
        y = margin;
      }
      doc.text(l, margin, y);
      y += 12;
    }
    y += 10;
  }

  // 4. SIGNATURE BLOCK (solo paziente: il medico non firma sul tablet l'anamnesi)
  y = renderSignatureBlock(
    doc,
    {
      firmaPazienteDataUrl: input.firmaPazienteDataUrl,
      firmaMedicoDataUrl: input.firmaMedicoDataUrl,
      firmatoIl: input.firmataIl,
      modalita,
      pazienteLabel: `${input.paziente.cognome} ${input.paziente.nome}`,
      operatoreLabel: input.operatoreNome,
      mostraFirmaMedico: false,
    },
    margin,
    y + 10,
  );

  const hash = await sha256Hex(
    `anamnesi|${input.versioneNumero}|${input.firmataIl.toISOString()}|${JSON.stringify(input.payload)}|${modalita}`,
  );
  const totalPages = doc.getNumberOfPages();
  doc.setPage(totalPages);
  doc.setFontSize(7).setTextColor(120);
  doc.text(`Hash integrità: ${hash}`, margin, pageH - 24);
  renderFooterPagine(doc, `Anamnesi v${input.versioneNumero}`, margin);
  const blob = doc.output("blob");
  return { blob, hash };
}
