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

function formatVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sì" : "No";
  if (Array.isArray(v)) return v.length > 0 ? v.join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function renderSection(
  doc: jsPDF,
  title: string,
  data: Record<string, unknown> | null,
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

  if (!data || Object.keys(data).length === 0) {
    doc.setTextColor(120);
    doc.text("Nessun dato.", margin, y);
    doc.setTextColor(0);
    return y + 14;
  }

  for (const [k, v] of Object.entries(data)) {
    if (y > pageH - 60) {
      doc.addPage();
      y = margin;
    }
    const line = `${k}: ${formatVal(v)}`;
    const wrapped = doc.splitTextToSize(line, pageW - margin * 2);
    for (const l of wrapped as string[]) {
      doc.text(l, margin, y);
      y += 12;
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

  // 4. SIGNATURE BLOCK (sempre presente; vuoto in modalità cartaceo)
  y = renderSignatureBlock(
    doc,
    {
      firmaPazienteDataUrl: input.firmaPazienteDataUrl,
      firmaMedicoDataUrl: input.firmaMedicoDataUrl,
      firmatoIl: input.firmataIl,
      modalita,
      pazienteLabel: `${input.paziente.cognome} ${input.paziente.nome}`,
      operatoreLabel: input.operatoreNome,
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
  const blob = doc.output("blob");
  return { blob, hash };
}
