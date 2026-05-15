// PDF "modulo vuoto" da firmare a mano (workflow cartaceo).
// NON viene salvato in storage e NON crea record DB: serve solo per stampa.
import { jsPDF } from "jspdf";
import { renderHeaderPaziente, renderHeaderStudio, type PazienteHeader } from "./pdf-template";
import { loadStudioForPdf } from "./pdf-studio-loader";

export interface ModuloVuotoInput {
  /** Se nome/cognome sono stringhe vuote vengono renderizzate come "_______" (modulo generico). */
  paziente: PazienteHeader | null;
  titolo: string;
  testo: string;
  versione: string;
}

const PLACEHOLDER = "_______________________";

function pazienteOrPlaceholder(p: PazienteHeader | null): PazienteHeader {
  if (p && p.cognome && p.nome) return p;
  return {
    cognome: PLACEHOLDER,
    nome: PLACEHOLDER,
    codice_fiscale: PLACEHOLDER,
    data_nascita: null,
  };
}

export async function generaPdfModuloVuoto(input: ModuloVuotoInput): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  // Carta intestata studio
  const { studio, logoDataUrl } = await loadStudioForPdf();
  y = renderHeaderStudio(doc, studio, logoDataUrl, margin, y);

  // Titolo principale
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text("MODULO DI CONSENSO INFORMATO", margin, y);
  y += 8;
  doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(120);
  doc.text("Da compilare e firmare a mano", margin, y + 8);
  doc.setTextColor(0);
  y += 22;

  // Header paziente (con placeholder se generico)
  y = renderHeaderPaziente(doc, pazienteOrPlaceholder(input.paziente), margin, y);

  // Titolo + versione
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(input.titolo, margin, y);
  y += 14;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(120);
  doc.text(`Versione ${input.versione}`, margin, y);
  doc.setTextColor(0);
  y += 16;

  // Testo
  doc.setFont("helvetica", "normal").setFontSize(10);
  const lines = doc.splitTextToSize(input.testo, pageW - margin * 2) as string[];
  for (const line of lines) {
    if (y > pageH - 240) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 13;
  }
  y += 14;

  // Data
  if (y > pageH - 200) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Data:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text("____________________", margin + 40, y);
  y += 22;

  // Checkbox scelta
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Scelta del paziente:", margin, y);
  y += 16;
  // ☐ Acconsento
  doc.setLineWidth(0.8).rect(margin, y - 9, 11, 11);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text("Acconsento", margin + 18, y);
  // ☐ Non acconsento
  doc.rect(margin + 130, y - 9, 11, 11);
  doc.text("Non acconsento", margin + 148, y);
  y += 36;

  // Firme (due colonne)
  if (y > pageH - 120) {
    doc.addPage();
    y = margin;
  }
  const colW = (pageW - margin * 2 - 30) / 2;
  doc.setDrawColor(120).line(margin, y, margin + colW, y);
  doc.line(margin + colW + 30, y, margin + colW * 2 + 30, y);
  y += 12;
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text("Firma del paziente", margin, y);
  doc.text("Firma del medico", margin + colW + 30, y);

  return doc.output("blob");
}
