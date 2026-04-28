import { jsPDF } from "jspdf";
import type { ConsensoCategoria } from "@/types/trattamenti";
import { sha256Hex } from "./hash";

export interface DatiPazientePdf {
  cognome: string;
  nome: string;
  data_nascita: string | null;
  codice_fiscale: string | null;
}

export interface ConsensoPdfInput {
  paziente: DatiPazientePdf;
  titolo: string;
  testo: string;
  versione: string;
  categoria: ConsensoCategoria;
  firmatoIl: Date;
  validoFinoA: Date | null;
  modalitaFirma: "tablet" | "pdf_caricato";
  firmaPazienteDataUrl: string | null;
  firmaMedicoDataUrl: string | null;
  operatoreNome: string | null;
  rifiutato: boolean;
  note: string | null;
}

const CATEGORIA_IT: Record<ConsensoCategoria, string> = {
  gdpr: "GDPR / Informativa privacy",
  uso_immagini: "Uso immagini",
  anamnesi: "Anamnesi",
  trattamento_singolo: "Consenso trattamento (singola seduta)",
  trattamento_ciclo: "Consenso ciclo di trattamento",
  altro: "Consenso",
};

export interface ConsensoPdfResult {
  blob: Blob;
  hash: string;
}

export async function generaPdfConsenso(
  input: ConsensoPdfInput,
): Promise<ConsensoPdfResult> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  // Intestazione
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text("MODULO DI CONSENSO INFORMATO", margin, y);
  y += 18;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(CATEGORIA_IT[input.categoria], margin, y);
  y += 16;

  // Banner rifiuto
  if (input.rifiutato) {
    doc.setDrawColor(200, 30, 30).setFillColor(255, 235, 235);
    doc.rect(margin, y, pageW - margin * 2, 28, "FD");
    doc.setTextColor(160, 0, 0).setFont("helvetica", "bold").setFontSize(11);
    doc.text("DICHIARAZIONE DI NON CONSENSO", margin + 10, y + 18);
    doc.setTextColor(0, 0, 0).setFont("helvetica", "normal").setFontSize(10);
    y += 38;
  }

  // Dati paziente
  doc.setDrawColor(180).setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 14;
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Paziente:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${input.paziente.cognome} ${input.paziente.nome}`, margin + 60, y);
  y += 14;
  if (input.paziente.data_nascita) {
    doc.setFont("helvetica", "bold");
    doc.text("Nato/a il:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(
      new Date(input.paziente.data_nascita).toLocaleDateString("it-IT"),
      margin + 60,
      y,
    );
    y += 14;
  }
  if (input.paziente.codice_fiscale) {
    doc.setFont("helvetica", "bold");
    doc.text("CF:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(input.paziente.codice_fiscale, margin + 60, y);
    y += 14;
  }
  doc.line(margin, y, pageW - margin, y);
  y += 16;

  // Titolo + versione
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text(input.titolo, margin, y);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(`v${input.versione}`, pageW - margin - 30, y);
  y += 18;

  // Testo (wrap)
  doc.setFont("helvetica", "normal").setFontSize(10);
  const lines = doc.splitTextToSize(input.testo, pageW - margin * 2);
  for (const line of lines as string[]) {
    if (y > pageH - 200) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 13;
  }
  y += 10;

  // Esito
  if (y > pageH - 180) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(
    input.rifiutato
      ? "Il/La paziente DICHIARA DI NON ACCONSENTIRE."
      : "Il/La paziente DICHIARA DI ACCONSENTIRE.",
    margin,
    y,
  );
  y += 20;

  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(
    `Data e ora: ${input.firmatoIl.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}`,
    margin,
    y,
  );
  y += 12;
  if (input.validoFinoA) {
    doc.text(
      `Valido fino al: ${input.validoFinoA.toLocaleDateString("it-IT")}`,
      margin,
      y,
    );
    y += 12;
  }
  if (input.note) {
    y += 6;
    doc.setFont("helvetica", "italic");
    doc.text(`Note: ${input.note}`, margin, y);
    doc.setFont("helvetica", "normal");
    y += 14;
  }

  // Firme
  y += 20;
  if (y > pageH - 140) {
    doc.addPage();
    y = margin;
  }
  const colW = (pageW - margin * 2 - 30) / 2;
  // Firma paziente
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
  doc.text(
    `${input.paziente.cognome} ${input.paziente.nome}`,
    margin,
    y,
  );
  if (input.firmaMedicoDataUrl && input.operatoreNome) {
    doc.text(input.operatoreNome, margin + colW + 30, y);
  }

  // Hash integrità
  const blob = doc.output("blob");
  const hash = await sha256Hex(
    `${input.titolo}|${input.testo}|${input.versione}|${input.firmatoIl.toISOString()}|${
      input.firmaPazienteDataUrl?.length ?? 0
    }|${input.rifiutato ? "REJ" : "ACC"}`,
  );
  // footer hash sull'ultima pagina
  const totalPages = doc.getNumberOfPages();
  doc.setPage(totalPages);
  doc.setFontSize(7).setTextColor(120);
  doc.text(`Hash integrità: ${hash}`, margin, pageH - 24);
  const finalBlob = doc.output("blob");

  return { blob: finalBlob, hash };
}
