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

function hasSectionData(obj: Record<string, unknown> | null): boolean {
  if (!obj) return false;
  return Object.values(obj).some((v) => {
    if (!isFilled(v)) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return hasSectionData(v as Record<string, unknown>);
    return true;
  });
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
  if (!g) return rows;
  const forceDefaults = hasSectionData(g);
  if (hasKey(g, "allergie") || forceDefaults) {
    rows.push({ label: "Allergie", value: boolValue(g.allergie) });
    if (g.allergie && isFilled(g.allergie_note)) {
      rows.push({ label: "  Note allergie", value: String(g.allergie_note) });
    }
  }
  addBoolRow(rows, g, "lidocaina_sensibile", "Sensibilità lidocaina", forceDefaults);
  for (const k of ["fumo", "alcol", "caffe"] as const) {
    if (isFilled(g[k])) {
      const lbl = k === "caffe" ? "Caffè" : k.charAt(0).toUpperCase() + k.slice(1);
      rows.push({ label: lbl, value: TERNARY_LABELS[String(g[k])] ?? String(g[k]) });
    }
  }
  if (isFilled(g.sport)) {
    rows.push({ label: "Sport", value: g.sport ? "Sì" : "No" });
    if (g.sport && isFilled(g.sport_note)) {
      rows.push({ label: "  Note sport", value: String(g.sport_note) });
    }
  }
  if (isFilled(g.alimentazione)) {
    rows.push({
      label: "Alimentazione",
      value: ALIMENTAZIONE_LABELS[String(g.alimentazione)] ?? String(g.alimentazione),
    });
  }
  if (isFilled(g.acqua_litri)) {
    rows.push({ label: "Acqua (litri/die)", value: String(g.acqua_litri) });
  }
  if (isFilled(g.condizioni_ormonali)) {
    rows.push({
      label: "Condizioni ormonali",
      value: CONDIZIONI_ORM_LABELS[String(g.condizioni_ormonali)] ?? String(g.condizioni_ormonali),
    });
  }
  if (hasKey(g, "vaccino_recente") || forceDefaults) {
    rows.push({
      label: "Vaccinazione ultimi 14 giorni",
      value: boolValue(g.vaccino_recente),
    });
    if (g.vaccino_recente && isFilled(g.vaccino_note)) {
      rows.push({ label: "  Note vaccino", value: String(g.vaccino_note) });
    }
  }
  return rows;
}

function buildPatologicaRows(p: Record<string, unknown> | null): Row[] {
  const rows: Row[] = [];
  if (!p) return rows;
  // Presenza patologie
  const forceDefaults = hasSectionData(p);
  if (hasKey(p, "presenti") || forceDefaults) {
    rows.push({ label: "Presenza patologie", value: boolValue(p.presenti) });
    if (p.presenti) {
      for (const k of Object.keys(PATOLOGIE_LABELS)) {
        if (p[k] === true) {
          rows.push({ label: `  ${PATOLOGIE_LABELS[k]}`, value: "Sì" });
        }
      }
      if (p.altro && isFilled(p.altro_note)) {
        rows.push({ label: "  Specifica altra patologia", value: String(p.altro_note) });
      }
    }
  }
  // Interventi chirurgici
  if (hasKey(p, "interventi") || forceDefaults) {
    rows.push({ label: "Interventi chirurgici / traumi", value: boolValue(p.interventi) });
    if (p.interventi) {
      const tipi = (p.interventi_tipi ?? {}) as Record<string, unknown>;
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
      if (isFilled(p.interventi_altro_note)) {
        rows.push({ label: "  Note interventi", value: String(p.interventi_altro_note) });
      } else if (isFilled(p.interventi_note)) {
        // legacy
        rows.push({ label: "  Note interventi", value: String(p.interventi_note) });
      }
    }
  }
  return rows;
}

function buildFarmacologicaRows(fa: Record<string, unknown> | null): Row[] {
  const rows: Row[] = [];
  if (!fa) return rows;
  const forceDefaults = hasSectionData(fa);
  if (hasKey(fa, "presenti") || forceDefaults) {
    rows.push({ label: "Terapie in corso", value: boolValue(fa.presenti) });
    if (fa.presenti) {
      for (const k of Object.keys(TERAPIE_LABELS)) {
        if (fa[k] === true) {
          rows.push({ label: `  ${TERAPIE_LABELS[k]}`, value: "Sì" });
        }
      }
      if (fa.altro && isFilled(fa.altro_note)) {
        rows.push({ label: "  Specifica altra terapia", value: String(fa.altro_note) });
      }
    }
  }
  return rows;
}

function buildEsteticaRows(es: Record<string, unknown> | null): Row[] {
  const rows: Row[] = [];
  if (!es) return rows;
  const forceDefaults = hasSectionData(es);
  if (isFilled(es.fototipo)) rows.push({ label: "Fototipo", value: String(es.fototipo) });
  if (isFilled(es.texture)) {
    rows.push({
      label: "Texture cutanea",
      value: TEXTURE_LABELS[String(es.texture)] ?? String(es.texture),
    });
  }
  addBoolRow(rows, es, "abbronzatura", "Abbronzatura attiva", forceDefaults);
  addBoolRow(rows, es, "elastosi", "Elastosi solare", forceDefaults);
  addBoolRow(rows, es, "spf_uso", "Uso SPF", forceDefaults);
  if (hasKey(es, "trattamenti_pregressi") || forceDefaults) {
    rows.push({
      label: "Trattamenti estetici pregressi",
      value: boolValue(es.trattamenti_pregressi),
    });
    if (es.trattamenti_pregressi && isFilled(es.trattamenti_pregressi_note)) {
      rows.push({
        label: "  Note trattamenti pregressi",
        value: String(es.trattamenti_pregressi_note),
      });
    }
  }
  if (hasKey(es, "reazioni_pregresse") || forceDefaults) {
    rows.push({
      label: "Reazioni avverse pregresse",
      value: boolValue(es.reazioni_pregresse),
    });
    if (es.reazioni_pregresse && isFilled(es.reazioni_pregresse_note)) {
      rows.push({
        label: "  Note reazioni",
        value: String(es.reazioni_pregresse_note),
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
