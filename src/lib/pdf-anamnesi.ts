import { jsPDF } from "jspdf";
import { sha256Hex } from "./hash";
import type { DatiPazientePdf } from "./pdf-consenso";
import {
  renderFooterPagine,
  renderHeaderPaziente,
  renderHeaderStudio,
  renderMetadata,
  renderSignatureBlock,
} from "./pdf-template";
import { loadStudioForPdf } from "./pdf-studio-loader";

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

const TERNARY_LABELS: Record<string, string> = {
  si: "Sì",
  no: "No",
  occasionale: "Occasionale",
};

const PATOLOGIE_LABELS: Record<string, string> = {
  diabete: "Diabete",
  ipertensione: "Ipertensione",
  tiroide: "Patologie tiroidee",
  cardiopatia: "Cardiopatie",
  varici: "Varici arti inferiori",
  coagulopatia: "Coagulopatie / patologie ematologiche",
  asma_bpco: "Asma / BPCO",
  oncologico_attivo: "Oncologico attivo",
  neoplasia_pregressa: "Neoplasia pregressa",
  autoimmune: "Malattie autoimmuni",
  cheloidi: "Cheloidi",
  dermatopatie: "Dermatopatie",
  hsv: "HSV (Herpes simplex)",
  altro: "Altro",
};

const TERAPIE_LABELS: Record<string, string> = {
  anticoagulanti: "Anticoagulante / antiaggregante",
  cortisonici: "Cortisonica in corso",
  isotretinoina: "Isotretinoina ultimi 6 mesi",
  immunosoppressori: "Immunosoppressiva",
  integratori: "Integratori / omeopatici",
  altro: "Altro",
};

const ALIMENTAZIONE_LABELS: Record<string, string> = {
  sana: "Sana ed equilibrata",
  abbastanza: "Abbastanza equilibrata",
  disequilibrata: "Disequilibrata",
};

const CONDIZIONI_ORM_LABELS: Record<string, string> = {
  nessuna: "Nessuna",
  gravidanza: "Gravidanza",
  allattamento: "Allattamento",
  menopausa: "Menopausa",
};

const TEXTURE_LABELS: Record<string, string> = {
  omogenea: "Omogenea",
  parziale: "Parziale",
  disomogenea: "Disomogenea",
};

interface Row {
  label: string;
  value: string;
}

function isFilled(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "";
}

function hasKey(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function boolValue(v: unknown): string {
  return v === true ? "Sì" : "No";
}

function addBoolRow(
  rows: Row[],
  obj: Record<string, unknown>,
  key: string,
  label: string,
  forceNo: boolean,
) {
  if (hasKey(obj, key) || forceNo) {
    rows.push({ label, value: boolValue(obj[key]) });
  }
}

function buildGeneraleRows(g: Record<string, unknown> | null): Row[] {
  const rows: Row[] = [];
  const data = g ?? {};
  const forceDefaults = true;
  if (hasKey(data, "allergie") || forceDefaults) {
    rows.push({ label: "Allergie", value: boolValue(data.allergie) });
    if (data.allergie && isFilled(data.allergie_note)) {
      rows.push({ label: "  Note allergie", value: String(data.allergie_note) });
    }
  }
  addBoolRow(rows, data, "lidocaina_sensibile", "Sensibilità lidocaina", forceDefaults);
  for (const k of ["fumo", "alcol", "caffe"] as const) {
    if (isFilled(data[k])) {
      const lbl = k === "caffe" ? "Caffè" : k.charAt(0).toUpperCase() + k.slice(1);
      rows.push({ label: lbl, value: TERNARY_LABELS[String(data[k])] ?? String(data[k]) });
    }
  }
  if (hasKey(data, "sport") || forceDefaults) {
    rows.push({ label: "Sport", value: boolValue(data.sport) });
    if (data.sport && isFilled(data.sport_note)) {
      rows.push({ label: "  Note sport", value: String(data.sport_note) });
    }
  }
  if (isFilled(data.alimentazione)) {
    rows.push({
      label: "Alimentazione",
      value: ALIMENTAZIONE_LABELS[String(data.alimentazione)] ?? String(data.alimentazione),
    });
  }
  if (isFilled(data.acqua_litri)) {
    rows.push({ label: "Acqua (litri/die)", value: String(data.acqua_litri) });
  }
  if (isFilled(data.condizioni_ormonali)) {
    rows.push({
      label: "Condizioni ormonali",
      value: CONDIZIONI_ORM_LABELS[String(data.condizioni_ormonali)] ?? String(data.condizioni_ormonali),
    });
  }
  if (hasKey(data, "vaccino_recente") || forceDefaults) {
    rows.push({
      label: "Vaccinazione ultimi 14 giorni",
      value: boolValue(data.vaccino_recente),
    });
    if (data.vaccino_recente && isFilled(data.vaccino_note)) {
      rows.push({ label: "  Note vaccino", value: String(data.vaccino_note) });
    }
  }
  return rows;
}

function buildPatologicaRows(p: Record<string, unknown> | null): Row[] {
  const rows: Row[] = [];
  const data = p ?? {};
  // Presenza patologie
  const forceDefaults = true;
  if (hasKey(data, "presenti") || forceDefaults) {
    rows.push({ label: "Presenza patologie", value: boolValue(data.presenti) });
    if (data.presenti) {
      for (const k of Object.keys(PATOLOGIE_LABELS)) {
        if (data[k] === true) {
          rows.push({ label: `  ${PATOLOGIE_LABELS[k]}`, value: "Sì" });
        }
      }
      if (data.altro && isFilled(data.altro_note)) {
        rows.push({ label: "  Specifica altra patologia", value: String(data.altro_note) });
      }
    }
  }
  // Interventi chirurgici
  if (hasKey(data, "interventi") || forceDefaults) {
    rows.push({ label: "Interventi chirurgici / traumi", value: boolValue(data.interventi) });
    if (data.interventi) {
      const tipi = (data.interventi_tipi ?? {}) as Record<string, unknown>;
      const tipiLabels: Record<string, string> = {
        maggiore: "Intervento maggiore",
        traumi: "Traumi",
        estetica: "Chirurgia estetica",
        dermatologica: "Chirurgia dermatologica",
        altro: "Altro",
      };
      for (const [k, l] of Object.entries(tipiLabels)) {
        if (tipi[k] === true) rows.push({ label: `  ${l}`, value: "Sì" });
      }
      if (isFilled(data.interventi_altro_note)) {
        rows.push({ label: "  Note interventi", value: String(data.interventi_altro_note) });
      } else if (isFilled(data.interventi_note)) {
        // legacy
        rows.push({ label: "  Note interventi", value: String(data.interventi_note) });
      }
    }
  }
  return rows;
}

function buildFarmacologicaRows(fa: Record<string, unknown> | null): Row[] {
  const rows: Row[] = [];
  const data = fa ?? {};
  const forceDefaults = true;
  if (hasKey(data, "presenti") || forceDefaults) {
    rows.push({ label: "Terapie in corso", value: boolValue(data.presenti) });
    if (data.presenti) {
      for (const k of Object.keys(TERAPIE_LABELS)) {
        if (data[k] === true) {
          rows.push({ label: `  ${TERAPIE_LABELS[k]}`, value: "Sì" });
        }
      }
      if (data.altro && isFilled(data.altro_note)) {
        rows.push({ label: "  Specifica altra terapia", value: String(data.altro_note) });
      }
    }
  }
  return rows;
}

function buildEsteticaRows(es: Record<string, unknown> | null): Row[] {
  const rows: Row[] = [];
  const data = es ?? {};
  const forceDefaults = true;
  if (isFilled(data.fototipo)) rows.push({ label: "Fototipo", value: String(data.fototipo) });
  if (isFilled(data.texture)) {
    rows.push({
      label: "Texture cutanea",
      value: TEXTURE_LABELS[String(data.texture)] ?? String(data.texture),
    });
  }
  addBoolRow(rows, data, "abbronzatura", "Abbronzatura attiva", forceDefaults);
  addBoolRow(rows, data, "elastosi", "Elastosi solare", forceDefaults);
  addBoolRow(rows, data, "spf_uso", "Uso SPF", forceDefaults);
  if (hasKey(data, "trattamenti_pregressi") || forceDefaults) {
    rows.push({
      label: "Trattamenti estetici pregressi",
      value: boolValue(data.trattamenti_pregressi),
    });
    if (data.trattamenti_pregressi && isFilled(data.trattamenti_pregressi_note)) {
      rows.push({
        label: "  Note trattamenti pregressi",
        value: String(data.trattamenti_pregressi_note),
      });
    }
  }
  if (hasKey(data, "reazioni_pregresse") || forceDefaults) {
    rows.push({
      label: "Reazioni avverse pregresse",
      value: boolValue(data.reazioni_pregresse),
    });
    if (data.reazioni_pregresse && isFilled(data.reazioni_pregresse_note)) {
      rows.push({
        label: "  Note reazioni",
        value: String(data.reazioni_pregresse_note),
      });
    }
  }
  return rows;
}

function renderSection(
  doc: jsPDF,
  title: string,
  rows: Row[],
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

  if (rows.length === 0) {
    doc.setTextColor(120);
    doc.text("Nessun dato", margin, y);
    doc.setTextColor(0);
    return y + 16;
  }

  const labelW = 220;
  for (const r of rows) {
    if (y > pageH - 60) {
      doc.addPage();
      y = margin;
    }
    doc.setFont("helvetica", "bold").setTextColor(60);
    const wrappedLabel = doc.splitTextToSize(`${r.label}:`, labelW - 6) as string[];
    doc.text(wrappedLabel, margin, y);
    doc.setFont("helvetica", "normal").setTextColor(0);
    const wrappedVal = doc.splitTextToSize(r.value, pageW - margin * 2 - labelW) as string[];
    doc.text(wrappedVal, margin + labelW, y);
    const lines = Math.max(wrappedLabel.length, wrappedVal.length);
    y += 12 * lines;
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

  const { studio, logoDataUrl } = await loadStudioForPdf();
  y = renderHeaderStudio(doc, studio, logoDataUrl, margin, y);

  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text("ANAMNESI", margin, y);
  y += 22;

  y = renderHeaderPaziente(doc, input.paziente, margin, y);

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

  y = renderSection(
    doc,
    "1. Generale",
    buildGeneraleRows(input.payload.generale),
    y,
    margin,
    pageW,
    pageH,
  );
  y = renderSection(
    doc,
    "2. Patologica",
    buildPatologicaRows(input.payload.patologica),
    y,
    margin,
    pageW,
    pageH,
  );
  y = renderSection(
    doc,
    "3. Farmacologica",
    buildFarmacologicaRows(input.payload.farmacologica),
    y,
    margin,
    pageW,
    pageH,
  );
  y = renderSection(
    doc,
    "4. Estetica",
    buildEsteticaRows(input.payload.estetica),
    y,
    margin,
    pageW,
    pageH,
  );

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
