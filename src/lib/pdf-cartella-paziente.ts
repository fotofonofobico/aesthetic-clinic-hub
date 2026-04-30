// Genera un PDF riassuntivo della cartella paziente:
// anagrafica, anamnesi, piani+sedute, consensi firmati, diario.
// Pensato per stampa medico-legale / consegna al paziente.
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { renderHeaderPaziente } from "./pdf-template";

const MARGIN = 36;
const LINE_H = 13;

interface PazienteFull {
  id: string;
  nome: string;
  cognome: string;
  sesso: string | null;
  data_nascita: string | null;
  codice_fiscale: string | null;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  provincia: string | null;
  professione: string | null;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("it-IT");
  } catch {
    return d;
  }
}

function fmtDateTime(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return d;
  }
}

class PdfBuilder {
  doc: jsPDF;
  y: number;
  pageW: number;
  pageH: number;

  constructor() {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
    this.pageW = this.doc.internal.pageSize.getWidth();
    this.pageH = this.doc.internal.pageSize.getHeight();
    this.y = MARGIN;
  }

  ensureSpace(needed: number) {
    if (this.y + needed > this.pageH - MARGIN) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  sectionTitle(title: string) {
    this.ensureSpace(28);
    this.y += 8;
    this.doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(0);
    this.doc.text(title, MARGIN, this.y);
    this.y += 6;
    this.doc.setDrawColor(120).setLineWidth(0.6);
    this.doc.line(MARGIN, this.y, this.pageW - MARGIN, this.y);
    this.y += 12;
  }

  kv(label: string, value: string) {
    this.ensureSpace(LINE_H);
    this.doc.setFont("helvetica", "bold").setFontSize(9);
    this.doc.text(label, MARGIN, this.y);
    this.doc.setFont("helvetica", "normal");
    const lines = this.doc.splitTextToSize(value || "—", this.pageW - MARGIN * 2 - 110) as string[];
    this.doc.text(lines, MARGIN + 110, this.y);
    this.y += LINE_H * Math.max(1, lines.length);
  }

  paragraph(text: string, opts?: { bold?: boolean; size?: number; color?: number }) {
    if (!text) return;
    this.doc.setFont("helvetica", opts?.bold ? "bold" : "normal").setFontSize(opts?.size ?? 9);
    this.doc.setTextColor(opts?.color ?? 0);
    const lines = this.doc.splitTextToSize(text, this.pageW - MARGIN * 2) as string[];
    for (const line of lines) {
      this.ensureSpace(LINE_H);
      this.doc.text(line, MARGIN, this.y);
      this.y += LINE_H;
    }
    this.doc.setTextColor(0);
  }

  spacer(h = 6) {
    this.y += h;
  }

  footerOnAllPages(label: string) {
    const total = this.doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      this.doc.setPage(i);
      this.doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(120);
      this.doc.text(
        `${label}  ·  Pagina ${i} di ${total}  ·  Generato il ${new Date().toLocaleString("it-IT")}`,
        MARGIN,
        this.pageH - 18,
      );
      this.doc.setTextColor(0);
    }
  }
}

export interface CartellaPdfResult {
  blob: Blob;
  filename: string;
}

export async function generaPdfCartellaPaziente(pazienteId: string): Promise<CartellaPdfResult> {
  // === Fetch dati ===
  const { data: pazRaw, error: pErr } = await supabase
    .from("pazienti")
    .select("*")
    .eq("id", pazienteId)
    .single();
  if (pErr || !pazRaw) throw new Error("Paziente non trovato");
  const paz = pazRaw as PazienteFull;

  const [anRes, plRes, sdRes, cfRes, ntRes, flRes, alRes] = await Promise.all([
    supabase.from("anamnesi").select("*").eq("paziente_id", pazienteId).maybeSingle(),
    supabase
      .from("piano_trattamento")
      .select("id, titolo, stato, descrizione, created_at, numero_sedute_previste")
      .eq("paziente_id", pazienteId)
      .order("created_at", { ascending: false }),
    supabase
      .from("seduta")
      .select("id, piano_id, numero_seduta, data_seduta, data_esecuzione_effettiva, completata, note_cliniche")
      .eq("paziente_id", pazienteId)
      .order("data_seduta", { ascending: true }),
    supabase
      .from("consenso_firmato")
      .select("titolo_snapshot, versione_snapshot, firmato_il, valido_fino_a, rifiutato, revocato_il, modalita_firma")
      .eq("paziente_id", pazienteId)
      .order("firmato_il", { ascending: false }),
    supabase
      .from("paziente_nota")
      .select("tipo, testo, data_evento, auto_generata")
      .eq("paziente_id", pazienteId)
      .order("data_evento", { ascending: false }),
    supabase
      .from("anamnesi_flag_rischio")
      .select("etichetta, severity, origine")
      .eq("paziente_id", pazienteId),
    supabase
      .from("paziente_alert")
      .select("testo, severity, attivo")
      .eq("paziente_id", pazienteId)
      .eq("attivo", true),
  ]);

  const b = new PdfBuilder();

  // === Header paziente ===
  b.doc.setFont("helvetica", "bold").setFontSize(16);
  b.doc.text("Cartella clinica paziente", MARGIN, b.y);
  b.y += 22;
  b.y = renderHeaderPaziente(
    b.doc,
    {
      cognome: paz.cognome,
      nome: paz.nome,
      codice_fiscale: paz.codice_fiscale,
      data_nascita: paz.data_nascita,
    },
    MARGIN,
    b.y,
  );

  // === Anagrafica ===
  b.sectionTitle("Anagrafica");
  b.kv("Sesso", paz.sesso ?? "—");
  b.kv("Email", paz.email ?? "—");
  b.kv("Telefono", paz.telefono ?? "—");
  b.kv(
    "Indirizzo",
    [paz.indirizzo, paz.cap, paz.citta, paz.provincia ? `(${paz.provincia})` : null]
      .filter(Boolean)
      .join(" ") || "—",
  );
  b.kv("Professione", paz.professione ?? "—");

  // === Flag e alert ===
  const flags = flRes.data ?? [];
  const alerts = alRes.data ?? [];
  if (flags.length || alerts.length) {
    b.sectionTitle("Flag clinici e alert attivi");
    for (const f of flags) {
      b.paragraph(`• [${f.severity}] ${f.etichetta} (${f.origine})`);
    }
    for (const a of alerts) {
      b.paragraph(`• [${a.severity}] ${a.testo}`);
    }
  }

  // === Anamnesi ===
  if (anRes.data) {
    b.sectionTitle("Anamnesi");
    const an = anRes.data as Record<string, unknown>;
    const sezioni: { label: string; key: string }[] = [
      { label: "Generale", key: "generale" },
      { label: "Patologica", key: "patologica" },
      { label: "Farmacologica", key: "farmacologica" },
      { label: "Estetica", key: "estetica" },
    ];
    for (const s of sezioni) {
      const val = an[s.key];
      if (val && typeof val === "object" && Object.keys(val).length > 0) {
        b.paragraph(s.label, { bold: true, size: 10 });
        const txt = JSON.stringify(val, null, 2)
          .replace(/[{}",]/g, "")
          .replace(/^\s*\n/gm, "")
          .trim();
        b.paragraph(txt);
        b.spacer(4);
      }
    }
    if (typeof an.note_libere === "string" && an.note_libere.trim()) {
      b.paragraph("Note libere", { bold: true, size: 10 });
      b.paragraph(an.note_libere);
    }
  }

  // === Piani e sedute ===
  const piani = plRes.data ?? [];
  const sedute = sdRes.data ?? [];
  if (piani.length) {
    b.sectionTitle("Piani di trattamento");
    for (const p of piani) {
      b.paragraph(`■ ${p.titolo}  —  Stato: ${p.stato}`, { bold: true, size: 10 });
      if (p.descrizione) b.paragraph(p.descrizione);
      const seduteP = sedute.filter((s) => s.piano_id === p.id);
      if (seduteP.length) {
        for (const s of seduteP) {
          const data = fmtDateTime(s.data_esecuzione_effettiva ?? s.data_seduta);
          const stato = s.completata ? "✓ eseguita" : "○ programmata";
          let line = `   #${s.numero_seduta} · ${data} · ${stato}`;
          if (s.note_cliniche) line += ` — ${s.note_cliniche}`;
          b.paragraph(line);
        }
      } else {
        b.paragraph("   (nessuna seduta registrata)");
      }
      b.spacer(4);
    }
  }

  // === Consensi ===
  const consensi = cfRes.data ?? [];
  if (consensi.length) {
    b.sectionTitle("Consensi firmati");
    for (const c of consensi) {
      const stato = c.rifiutato
        ? "RIFIUTATO"
        : c.revocato_il
          ? `REVOCATO il ${fmtDateTime(c.revocato_il)}`
          : c.valido_fino_a
            ? `valido fino al ${fmtDate(c.valido_fino_a)}`
            : "valido";
      b.paragraph(
        `• ${c.titolo_snapshot} (v${c.versione_snapshot}) — firmato il ${fmtDateTime(c.firmato_il)} — ${stato}`,
      );
    }
  }

  // === Diario ===
  const note = ntRes.data ?? [];
  if (note.length) {
    b.sectionTitle("Diario clinico");
    for (const n of note) {
      const tag = n.auto_generata ? "[auto]" : `[${n.tipo}]`;
      b.paragraph(`${fmtDateTime(n.data_evento)}  ${tag}`, { bold: true, size: 9 });
      b.paragraph(n.testo);
      b.spacer(4);
    }
  }

  b.footerOnAllPages(`${paz.cognome} ${paz.nome} — Cartella clinica`);

  const blob = b.doc.output("blob");
  const safe = `${paz.cognome}_${paz.nome}`.replace(/[^\w\-]+/g, "_");
  return { blob, filename: `cartella_${safe}.pdf` };
}
