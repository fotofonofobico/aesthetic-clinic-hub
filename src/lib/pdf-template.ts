// Template PDF condiviso: header paziente, metadata, sezione firma.
// Usato sia da generaPdfConsenso sia da generaPdfAnamnesi per garantire
// la stessa struttura su tutti i documenti.
import type { jsPDF } from "jspdf";

export interface PazienteHeader {
  cognome: string;
  nome: string;
  codice_fiscale: string | null;
  data_nascita: string | null;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("it-IT");
  } catch {
    return d;
  }
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Header paziente in cima al PDF. OBBLIGATORIO: blocca la generazione se
 * mancano cognome o nome.
 */
export function renderHeaderPaziente(
  doc: jsPDF,
  paz: PazienteHeader,
  margin: number,
  startY: number,
): number {
  if (!paz.cognome || !paz.nome) {
    throw new Error("PDF invalido: header paziente mancante (cognome/nome obbligatori)");
  }
  let y = startY;
  const pageW = doc.internal.pageSize.getWidth();
  doc.setDrawColor(180).setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 14;
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Paziente:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${paz.cognome.toUpperCase()} ${paz.nome}`, margin + 70, y);
  y += 14;
  if (paz.codice_fiscale) {
    doc.setFont("helvetica", "bold");
    doc.text("CF:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(paz.codice_fiscale, margin + 70, y);
    y += 14;
  }
  if (paz.data_nascita) {
    doc.setFont("helvetica", "bold");
    doc.text("Data di nascita:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(fmtDate(paz.data_nascita), margin + 70, y);
    y += 14;
  }
  doc.line(margin, y, pageW - margin, y);
  return y + 14;
}

export interface DocMetadata {
  tipoDocumento: string; // es: "Consenso informato", "Anamnesi"
  titolo: string;
  versione: string;
  firmatoIl: Date | null;
}

export function renderMetadata(
  doc: jsPDF,
  meta: DocMetadata,
  margin: number,
  startY: number,
): number {
  if (!meta.tipoDocumento || !meta.titolo) {
    throw new Error("PDF invalido: metadata documento mancanti");
  }
  let y = startY;
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Documento:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(meta.tipoDocumento, margin + 70, y);
  y += 13;
  doc.setFont("helvetica", "bold");
  doc.text("Titolo:", margin, y);
  doc.setFont("helvetica", "normal");
  const pageW = doc.internal.pageSize.getWidth();
  const titleLines = doc.splitTextToSize(meta.titolo, pageW - margin * 2 - 70) as string[];
  doc.text(titleLines, margin + 70, y);
  y += 13 * titleLines.length;
  doc.setFont("helvetica", "bold");
  doc.text("Versione:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(meta.versione, margin + 70, y);
  y += 13;
  if (meta.firmatoIl) {
    doc.setFont("helvetica", "bold");
    doc.text("Firmato il:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(fmtDateTime(meta.firmatoIl), margin + 70, y);
    y += 13;
  }
  return y + 6;
}

export interface SignatureBlockInput {
  firmaPazienteDataUrl: string | null;
  firmaMedicoDataUrl: string | null;
  firmatoIl: Date;
  modalita: "tablet" | "cartaceo" | "pdf_caricato";
  pazienteLabel: string;
  operatoreLabel: string | null;
}

export function renderSignatureBlock(
  doc: jsPDF,
  input: SignatureBlockInput,
  margin: number,
  startY: number,
): number {
  if (!input.firmatoIl) {
    throw new Error("PDF invalido: data firma mancante");
  }
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = startY;
  if (y > pageH - 160) {
    doc.addPage();
    y = margin;
  }
  const colW = (pageW - margin * 2 - 30) / 2;
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Firma del paziente", margin, y);
  doc.text("Firma del medico", margin + colW + 30, y);
  y += 8;

  // Box firma paziente
  if (input.firmaPazienteDataUrl) {
    try {
      doc.addImage(input.firmaPazienteDataUrl, "PNG", margin, y, colW, 70);
    } catch {
      /* skip */
    }
  }
  // Box firma medico
  if (input.firmaMedicoDataUrl) {
    try {
      doc.addImage(input.firmaMedicoDataUrl, "PNG", margin + colW + 30, y, colW, 70);
    } catch {
      /* skip */
    }
  }
  y += 78;
  doc.setDrawColor(150).line(margin, y, margin + colW, y);
  doc.line(margin + colW + 30, y, margin + colW * 2 + 30, y);
  y += 12;
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(input.pazienteLabel, margin, y);
  if (input.operatoreLabel) {
    doc.text(input.operatoreLabel, margin + colW + 30, y);
  }
  y += 12;
  doc.setFontSize(8).setTextColor(80);
  doc.text(`Data: ${fmtDateTime(input.firmatoIl)}`, margin, y);
  if (input.modalita === "cartaceo" || input.modalita === "pdf_caricato") {
    doc.text("Modalità: cartaceo", margin + colW + 30, y);
  }
  doc.setTextColor(0);
  return y + 10;
}
