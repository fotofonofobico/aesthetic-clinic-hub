import { jsPDF } from "jspdf";
import { sha256Hex } from "./hash";
import type { DatiPazientePdf } from "./pdf-consenso";

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
  firmaPazienteDataUrl: string | null;
  firmaMedicoDataUrl: string | null;
  operatoreNome: string | null;
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

  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text("ANAMNESI", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`Versione ${input.versioneNumero}`, margin, y);
  y += 16;

  doc.setDrawColor(180).line(margin, y, pageW - margin, y);
  y += 14;
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Paziente:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${input.paziente.cognome} ${input.paziente.nome}`, margin + 60, y);
  y += 14;
  if (input.paziente.codice_fiscale) {
    doc.setFont("helvetica", "bold");
    doc.text("CF:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(input.paziente.codice_fiscale, margin + 60, y);
    y += 14;
  }
  doc.line(margin, y, pageW - margin, y);
  y += 16;

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

  // Firme
  y += 20;
  if (y > pageH - 140) {
    doc.addPage();
    y = margin;
  }
  const colW = (pageW - margin * 2 - 30) / 2;
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Firma paziente", margin, y);
  if (input.firmaMedicoDataUrl) {
    doc.text("Firma medico", margin + colW + 30, y);
  }
  y += 8;
  if (input.firmaPazienteDataUrl) {
    try {
      doc.addImage(input.firmaPazienteDataUrl, "PNG", margin, y, colW, 70);
    } catch {
      /* skip */
    }
  }
  if (input.firmaMedicoDataUrl) {
    try {
      doc.addImage(input.firmaMedicoDataUrl, "PNG", margin + colW + 30, y, colW, 70);
    } catch {
      /* skip */
    }
  }
  y += 78;
  doc.setDrawColor(150).line(margin, y, margin + colW, y);
  if (input.firmaMedicoDataUrl) {
    doc.line(margin + colW + 30, y, margin + colW * 2 + 30, y);
  }
  y += 12;
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(`${input.paziente.cognome} ${input.paziente.nome}`, margin, y);
  if (input.firmaMedicoDataUrl && input.operatoreNome) {
    doc.text(input.operatoreNome, margin + colW + 30, y);
  }
  y += 14;
  doc.text(
    `Firmato: ${input.firmataIl.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}`,
    margin,
    y,
  );

  const hash = await sha256Hex(
    `anamnesi|${input.versioneNumero}|${input.firmataIl.toISOString()}|${JSON.stringify(input.payload)}`,
  );
  const totalPages = doc.getNumberOfPages();
  doc.setPage(totalPages);
  doc.setFontSize(7).setTextColor(120);
  doc.text(`Hash integrità: ${hash}`, margin, pageH - 24);
  const blob = doc.output("blob");
  return { blob, hash };
}
