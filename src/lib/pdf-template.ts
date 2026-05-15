// Template PDF condiviso: intestazione studio (carta intestata),
// header paziente, metadata, sezione firma.
// Usato da tutti i generatori PDF per garantire la stessa struttura.
import type { jsPDF } from "jspdf";
import type { StudioInfo } from "@/hooks/use-studio-info";

/**
 * Carta intestata: logo a sinistra, ragione sociale + contatti.
 * Va chiamata in cima al PDF, prima di tutto. Se studio è null ritorna startY invariato.
 */
export function renderHeaderStudio(
  doc: jsPDF,
  studio: StudioInfo | null,
  logoDataUrl: string | null,
  margin: number,
  startY: number,
): number {
  if (!studio) return startY;
  const pageW = doc.internal.pageSize.getWidth();
  let y = startY;
  const logoSize = 56;
  const textX = logoDataUrl ? margin + logoSize + 14 : margin;
  const textRight = pageW - margin;

  if (logoDataUrl) {
    try {
      // Determina formato dal dataURL (image/jpeg|png|webp)
      const fmt = /^data:image\/(jpe?g|png|webp);/i.exec(logoDataUrl)?.[1];
      const jsFmt =
        fmt && /^jpe?g$/i.test(fmt) ? "JPEG" : fmt && /webp/i.test(fmt) ? "WEBP" : "PNG";
      doc.addImage(logoDataUrl, jsFmt, margin, y, logoSize, logoSize, undefined, "FAST");
    } catch {
      /* logo opzionale */
    }
  }

  let ty = y + 4;
  if (studio.ragione_sociale) {
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(0);
    doc.text(studio.ragione_sociale, textX, ty);
    ty += 15;
  }
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(90);

  const indir = [
    studio.indirizzo,
    [studio.cap, studio.citta].filter(Boolean).join(" "),
    studio.provincia ? `(${studio.provincia})` : null,
  ]
    .filter(Boolean)
    .join(", ");
  if (indir) {
    doc.text(indir, textX, ty);
    ty += 11;
  }
  const contatti = [
    studio.telefono ? `Tel: ${studio.telefono}` : null,
    studio.email ? `Email: ${studio.email}` : null,
    studio.pec ? `PEC: ${studio.pec}` : null,
    studio.sito_web ? studio.sito_web : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (contatti) {
    const lines = doc.splitTextToSize(contatti, pageW - margin - textX) as string[];
    for (const l of lines) {
      doc.text(l, textX, ty);
      ty += 11;
    }
  }
  if (studio.direttore_sanitario) {
    doc.text(`Direttore sanitario: ${studio.direttore_sanitario}`, textX, ty);
    ty += 11;
  }
  if (studio.partita_iva || studio.codice_fiscale) {
    const piva = [
      studio.partita_iva ? `P.IVA ${studio.partita_iva}` : null,
      studio.codice_fiscale ? `C.F. ${studio.codice_fiscale}` : null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    doc.text(piva, textX, ty);
    ty += 11;
  }
  doc.setTextColor(0);

  const headerBottom = Math.max(ty, y + (logoDataUrl ? logoSize : 0)) + 8;
  doc.setDrawColor(180).setLineWidth(0.5).line(margin, headerBottom, textRight, headerBottom);
  return headerBottom + 14;
}

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
  const mostraFirmaMedico = input.mostraFirmaMedico === true;
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
