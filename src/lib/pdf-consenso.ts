import { jsPDF } from "jspdf";
import type { ConsensoCategoria } from "@/types/trattamenti";
import { sha256Hex } from "./hash";
import {
  renderFooterPagine,
  renderHeaderPaziente,
  renderHeaderStudio,
  renderMetadata,
  renderSignatureBlock,
} from "./pdf-template";
import { loadStudioForPdf } from "./pdf-studio-loader";

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

  // Carta intestata studio (se configurato)
  const { studio, logoDataUrl } = await loadStudioForPdf();
  y = renderHeaderStudio(doc, studio, logoDataUrl, margin, y);

  // Titolo principale
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text("MODULO DI CONSENSO INFORMATO", margin, y);
  y += 22;

  // Banner rifiuto
  if (input.rifiutato) {
    doc.setDrawColor(200, 30, 30).setFillColor(255, 235, 235);
    doc.rect(margin, y, pageW - margin * 2, 28, "FD");
    doc.setTextColor(160, 0, 0).setFont("helvetica", "bold").setFontSize(11);
    doc.text("DICHIARAZIONE DI NON CONSENSO", margin + 10, y + 18);
    doc.setTextColor(0, 0, 0).setFont("helvetica", "normal").setFontSize(10);
    y += 38;
  }

  // 1. HEADER paziente
  y = renderHeaderPaziente(doc, input.paziente, margin, y);

  // 2. METADATA
  y = renderMetadata(
    doc,
    {
      tipoDocumento: `Consenso informato — ${CATEGORIA_IT[input.categoria]}`,
      titolo: input.titolo,
      versione: input.versione,
      firmatoIl: input.firmatoIl,
    },
    margin,
    y,
  );

  if (input.validoFinoA) {
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(
      `Valido fino al: ${input.validoFinoA.toLocaleDateString("it-IT")}`,
      margin,
      y,
    );
    y += 14;
  }

  // 3. CONTENUTO
  doc.setFont("helvetica", "normal").setFontSize(10);
  const lines = doc.splitTextToSize(input.testo, pageW - margin * 2);
  // Riempi la pagina fino a margine inferiore (lasciando spazio al footer);
  // se non c'è spazio sufficiente, lo signature block si occupa di andare a
  // pagina nuova.
  const bodyBottom = pageH - margin - 20;
  for (const line of lines as string[]) {
    if (y > bodyBottom) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 13;
  }
  y += 10;

  // Esito
  if (y > pageH - 80) {
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
  y += 18;

  if (input.note) {
    doc.setFont("helvetica", "italic").setFontSize(9);
    doc.text(`Note: ${input.note}`, margin, y);
    doc.setFont("helvetica", "normal");
    y += 14;
  }

  // 4. SIGNATURE BLOCK — solo paziente. Il medico non firma sui consensi.
  y = renderSignatureBlock(
    doc,
    {
      firmaPazienteDataUrl: input.firmaPazienteDataUrl,
      firmaMedicoDataUrl: null,
      firmatoIl: input.firmatoIl,
      modalita: input.modalitaFirma,
      pazienteLabel: `${input.paziente.cognome} ${input.paziente.nome}`,
      operatoreLabel: null,
      mostraFirmaMedico: false,
    },
    margin,
    y + 10,
  );

  // Hash integrità
  const hash = await sha256Hex(
    `${input.titolo}|${input.testo}|${input.versione}|${input.firmatoIl.toISOString()}|${
      input.firmaPazienteDataUrl?.length ?? 0
    }|${input.rifiutato ? "REJ" : "ACC"}`,
  );
  const totalPages = doc.getNumberOfPages();
  doc.setPage(totalPages);
  doc.setFontSize(7).setTextColor(120);
  doc.text(`Hash integrità: ${hash}`, margin, pageH - 24);
  renderFooterPagine(doc, `Consenso — ${input.titolo}`, margin);
  const finalBlob = doc.output("blob");

  return { blob: finalBlob, hash };
}
