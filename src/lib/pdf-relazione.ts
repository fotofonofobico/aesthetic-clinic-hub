import { jsPDF } from "jspdf";
import { renderFooterPagine, renderHeaderPaziente } from "./pdf-template";
import type { StudioInfo } from "@/hooks/use-studio-info";

export interface RelazioneInput {
  paziente: {
    cognome: string;
    nome: string;
    codice_fiscale: string | null;
    data_nascita: string | null;
  };
  studio: StudioInfo | null;
  dataNota: Date;
  testo: string;
  /** Nome del medico/operatore che firma. Opzionale: lascia vuoto per firma manuale. */
  medicoNome?: string | null;
  /** Titolo opzionale del documento. Default: "Relazione clinica". */
  titolo?: string;
}

function fmtDateLong(d: Date): string {
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });
}

export function generaPdfRelazione(input: RelazioneInput): { blob: Blob; filename: string } {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  let y = margin;

  // Intestazione studio (carta intestata)
  if (input.studio) {
    doc.setFont("helvetica", "bold").setFontSize(13);
    if (input.studio.ragione_sociale) {
      doc.text(input.studio.ragione_sociale, margin, y);
      y += 16;
    }
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(90);
    const indir = [
      input.studio.indirizzo,
      [input.studio.cap, input.studio.citta].filter(Boolean).join(" "),
      input.studio.provincia,
    ]
      .filter(Boolean)
      .join(", ");
    if (indir) {
      doc.text(indir, margin, y);
      y += 12;
    }
    const contatti = [
      input.studio.telefono ? `Tel: ${input.studio.telefono}` : null,
      input.studio.email ? `Email: ${input.studio.email}` : null,
      input.studio.pec ? `PEC: ${input.studio.pec}` : null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    if (contatti) {
      doc.text(contatti, margin, y);
      y += 12;
    }
    if (input.studio.direttore_sanitario) {
      doc.text(`Direttore sanitario: ${input.studio.direttore_sanitario}`, margin, y);
      y += 12;
    }
    doc.setTextColor(0);
    y += 6;
    doc.setDrawColor(180).setLineWidth(0.5).line(margin, y, pageW - margin, y);
    y += 18;
  }

  // Titolo documento
  const titolo = input.titolo ?? "Relazione clinica";
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text(titolo.toUpperCase(), margin, y);
  y += 20;

  // Data
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(80);
  doc.text(`${fmtDateLong(input.dataNota)}`, pageW - margin, y - 18, { align: "right" });
  doc.setTextColor(0);

  // Header paziente
  y = renderHeaderPaziente(doc, input.paziente, margin, y);

  // Corpo
  doc.setFont("helvetica", "normal").setFontSize(11);
  const lines = doc.splitTextToSize(input.testo, pageW - margin * 2) as string[];
  for (const l of lines) {
    if (y > pageH - 140) {
      doc.addPage();
      y = margin;
    }
    doc.text(l, margin, y);
    y += 16;
  }
  y += 30;

  // Firma medico
  if (y > pageH - 120) {
    doc.addPage();
    y = pageH - 160;
  } else {
    y = Math.max(y, pageH - 160);
  }
  const colW = (pageW - margin * 2 - 40) / 2;
  const xFirma = pageW - margin - colW;
  doc.setDrawColor(150).line(xFirma, y, xFirma + colW, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(80);
  doc.text("Firma del medico", xFirma + colW / 2, y + 12, { align: "center" });
  if (input.medicoNome) {
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(0);
    doc.text(input.medicoNome, xFirma + colW / 2, y + 26, { align: "center" });
  }
  doc.setTextColor(0);

  renderFooterPagine(doc, titolo, margin);

  const blob = doc.output("blob");
  const slug = `${input.paziente.cognome}-${input.paziente.nome}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const dateStr = input.dataNota.toISOString().slice(0, 10);
  const filename = `relazione-${slug}-${dateStr}.pdf`;

  return { blob, filename };
}
