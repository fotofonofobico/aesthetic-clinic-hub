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
 * Header paziente: box bordato compatto in alto. Migliora la leggibilità
 * stampata e separa visivamente i dati anagrafici dal corpo del documento.
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
  const pageW = doc.internal.pageSize.getWidth();
  const boxX = margin;
  const boxY = startY;
  const boxW = pageW - margin * 2;
  const lineH = 13;
  // Calcolo righe necessarie
  const rows: Array<[string, string]> = [
    ["Paziente", `${paz.cognome.toUpperCase()} ${paz.nome}`],
  ];
  if (paz.data_nascita) rows.push(["Data di nascita", fmtDate(paz.data_nascita)]);
  if (paz.codice_fiscale) rows.push(["Codice fiscale", paz.codice_fiscale]);
  const boxH = rows.length * lineH + 14;

  doc.setDrawColor(180).setLineWidth(0.6);
  doc.setFillColor(248, 249, 251);
  doc.rect(boxX, boxY, boxW, boxH, "FD");

  let y = boxY + 16;
  doc.setFontSize(9);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "bold").setTextColor(80);
    doc.text(`${label}:`, boxX + 10, y);
    doc.setFont("helvetica", "normal").setTextColor(0);
    doc.text(value, boxX + 100, y);
    y += lineH;
  }
  return boxY + boxH + 14;
}

export interface DocMetadata {
  tipoDocumento: string;
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
  const pageW = doc.internal.pageSize.getWidth();
  let y = startY;
  doc.setFontSize(8).setTextColor(110);
  doc.setFont("helvetica", "normal");
  const parts: string[] = [
    meta.tipoDocumento,
    `v. ${meta.versione}`,
  ];
  if (meta.firmatoIl) parts.push(`Firmato il ${fmtDateTime(meta.firmatoIl)}`);
  doc.text(parts.join("  •  "), margin, y);
  doc.setTextColor(0);
  y += 10;
  doc.setDrawColor(220).setLineWidth(0.4).line(margin, y, pageW - margin, y);
  return y + 14;
}

export interface SignatureBlockInput {
  firmaPazienteDataUrl: string | null;
  firmaMedicoDataUrl: string | null;
  firmatoIl: Date;
  modalita: "tablet" | "cartaceo" | "pdf_caricato";
  pazienteLabel: string;
  operatoreLabel: string | null;
  /**
   * Default false: il medico non firma sui documenti del paziente.
   * Lasciato per estensioni future (referti, relazioni cliniche).
   */
  mostraFirmaMedico?: boolean;
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
  const mostraFirmaMedico = input.mostraFirmaMedico !== false;
  let y = startY;
  if (y > pageH - 160) {
    doc.addPage();
    y = margin;
  }

  const colW = mostraFirmaMedico ? (pageW - margin * 2 - 30) / 2 : pageW - margin * 2;
  const xMedico = margin + colW + 30;

  // Data sopra
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(80);
  doc.text(`Data: ${fmtDateTime(input.firmatoIl)}`, margin, y);
  doc.setTextColor(0);
  y += 14;

  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Firma del paziente", margin, y);
  if (mostraFirmaMedico) doc.text("Firma del medico", xMedico, y);
  y += 8;

  // Box firma paziente
  if (input.firmaPazienteDataUrl) {
    try {
      doc.addImage(input.firmaPazienteDataUrl, "PNG", margin, y, colW, 70);
    } catch {
      /* skip */
    }
  }
  if (mostraFirmaMedico && input.firmaMedicoDataUrl) {
    try {
      doc.addImage(input.firmaMedicoDataUrl, "PNG", xMedico, y, colW, 70);
    } catch {
      /* skip */
    }
  }
  y += 78;
  doc.setDrawColor(150).line(margin, y, margin + colW, y);
  if (mostraFirmaMedico) doc.line(xMedico, y, xMedico + colW, y);
  y += 12;
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(input.pazienteLabel, margin, y);
  if (mostraFirmaMedico && input.operatoreLabel) {
    doc.text(input.operatoreLabel, xMedico, y);
  }
  y += 12;
  if (input.modalita === "cartaceo" || input.modalita === "pdf_caricato") {
    doc.setFontSize(8).setTextColor(120);
    doc.text("Modalità: cartaceo", margin, y);
    doc.setTextColor(0);
    y += 10;
  }
  return y + 6;
}

/**
 * Footer "Pagina X di Y" + nome documento, applicato a tutte le pagine.
 * Va chiamato a fine generazione.
 */
export function renderFooterPagine(doc: jsPDF, nomeDocumento: string, margin: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(140);
    doc.text(nomeDocumento, margin, pageH - 18);
    doc.text(`Pagina ${i} di ${total}`, pageW - margin, pageH - 18, { align: "right" });
    doc.setTextColor(0);
  }
}
