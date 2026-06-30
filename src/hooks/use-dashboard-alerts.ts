import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AlertItem {
  key: string;
  label: string;
  count: number;
  severity: "warning" | "critical";
  to: string;
}

async function fetchAlerts(): Promise<AlertItem[]> {
  const out: AlertItem[] = [];
  const ora = new Date();
  const tra30 = new Date();
  tra30.setDate(tra30.getDate() + 30);
  const limite12mesi = new Date();
  limite12mesi.setFullYear(limite12mesi.getFullYear() - 1);

  const [pazientiRes, lottiRes, cfRes, seduteRes] = await Promise.all([
    supabase
      .from("pazienti")
      .select("id, anamnesi(id, updated_at)")
      .is("deleted_at", null)
      .limit(1000),
    supabase
      .from("prodotto_lotto")
      .select(
        "id, quantita_disponibile, data_scadenza, prodotto:prodotto_id(soglia_minima, modalita_tracking)",
      )
      .gt("quantita_disponibile", 0),
    supabase
      .from("consenso_firmato")
      .select(
        "id, valido_fino_a, revocato_il, rifiutato, sedute_max_snapshot, sedute_consumate, durata_tipo_snapshot",
      )
      .is("revocato_il", null)
      .eq("rifiutato", false)
      .limit(1000),
    supabase
      .from("seduta")
      .select("id, paziente_id, trattamento_id")
      .gte("data_seduta", ora.toISOString())
      .lte("data_seduta", new Date(Date.now() + 7 * 86400000).toISOString())
      .eq("completata", false)
      .limit(1000),
  ]);

  // Anamnesi mancanti o > 12 mesi
  const incomplete = (pazientiRes.data ?? []).filter((p: any) => {
    const an = (p.anamnesi as any[])?.[0];
    if (!an) return true;
    return an.updated_at && new Date(an.updated_at) < limite12mesi;
  }).length;
  if (incomplete > 0)
    out.push({
      key: "anamnesi",
      label: "Anamnesi mancanti o > 12 mesi",
      count: incomplete,
      severity: "warning",
      to: "/pazienti",
    });

  // Lotti magazzino
  let basse = 0,
    scaduti = 0,
    inScadenza = 0;
  (lottiRes.data ?? []).forEach((l: any) => {
    if (l.prodotto?.modalita_tracking !== "tracciato") return;
    const soglia = l.prodotto?.soglia_minima ?? 0;
    if (l.data_scadenza) {
      const d = new Date(l.data_scadenza);
      if (d < ora) scaduti++;
      else if (d < tra30) inScadenza++;
    }
    if (soglia && l.quantita_disponibile <= soglia) basse++;
  });
  if (scaduti > 0)
    out.push({ key: "scaduti", label: "Lotti scaduti", count: scaduti, severity: "critical", to: "/magazzino" });
  if (inScadenza > 0)
    out.push({ key: "scadenza", label: "Lotti in scadenza < 30gg", count: inScadenza, severity: "warning", to: "/magazzino" });
  if (basse > 0)
    out.push({ key: "scorte", label: "Scorte sotto soglia", count: basse, severity: "warning", to: "/magazzino" });

  // Consensi in scadenza
  let inScad = 0;
  (cfRes.data ?? []).forEach((c: any) => {
    if (c.valido_fino_a) {
      const d = new Date(c.valido_fino_a);
      if (d > ora && d < tra30) inScad++;
    }
    if (
      c.durata_tipo_snapshot === "sedute" &&
      typeof c.sedute_max_snapshot === "number" &&
      typeof c.sedute_consumate === "number" &&
      c.sedute_max_snapshot - c.sedute_consumate === 1
    )
      inScad++;
  });
  if (inScad > 0)
    out.push({ key: "cscad", label: "Consensi in scadenza", count: inScad, severity: "warning", to: "/consensi" });

  // Consensi mancanti per sedute imminenti
  const sedRows = (seduteRes.data ?? []) as Array<{
    id: string;
    paziente_id: string;
    trattamento_id: string | null;
  }>;
  if (sedRows.length > 0) {
    const trattIds = [
      ...new Set(sedRows.map((s) => s.trattamento_id).filter(Boolean) as string[]),
    ];
    const trattToTpl = new Map<string, string | null>();
    if (trattIds.length > 0) {
      const { data: tratts } = await supabase
        .from("trattamenti")
        .select("id, consenso_template_id")
        .in("id", trattIds);
      (tratts ?? []).forEach((t: any) => trattToTpl.set(t.id, t.consenso_template_id ?? null));
    }
    const pIds = [...new Set(sedRows.map((s) => s.paziente_id))];
    const consensiByPz = new Map<string, Set<string>>();
    if (pIds.length > 0) {
      const { data: cons } = await supabase
        .from("consenso_firmato")
        .select(
          "paziente_id, template_id, valido_fino_a, revocato_il, rifiutato, sedute_max_snapshot, sedute_consumate, durata_tipo_snapshot",
        )
        .in("paziente_id", pIds)
        .is("revocato_il", null)
        .eq("rifiutato", false);
      (cons ?? []).forEach((c: any) => {
        if (!c.template_id) return;
        if (c.valido_fino_a && new Date(c.valido_fino_a) <= ora) return;
        if (
          c.durata_tipo_snapshot === "sedute" &&
          typeof c.sedute_max_snapshot === "number" &&
          typeof c.sedute_consumate === "number" &&
          c.sedute_consumate >= c.sedute_max_snapshot
        )
          return;
        const s = consensiByPz.get(c.paziente_id) ?? new Set<string>();
        s.add(c.template_id);
        consensiByPz.set(c.paziente_id, s);
      });
    }
    const mancanti = new Set<string>();
    sedRows.forEach((s) => {
      if (!s.trattamento_id) return;
      const tplId = trattToTpl.get(s.trattamento_id);
      if (!tplId) return;
      const valid = consensiByPz.get(s.paziente_id);
      if (!valid || !valid.has(tplId)) mancanti.add(s.paziente_id);
    });
    if (mancanti.size > 0)
      out.push({
        key: "consensi",
        label: "Consenso mancante (sedute < 7gg)",
        count: mancanti.size,
        severity: "critical",
        to: "/consensi",
      });
  }

  return out;
}

export function useDashboardAlerts() {
  return useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: fetchAlerts,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });
}
