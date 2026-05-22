import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Euro, Activity, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights")({
  component: InsightsPage,
});

interface SedutaRow {
  data_seduta: string | null;
  data_esecuzione_effettiva: string | null;
  trattamento_id: string | null;
  completata: boolean;
}
interface PianoRow {
  prezzo_finale: number | null;
  prezzo_totale: number | null;
  created_at: string;
  stato: string;
}
interface MovimentoRow {
  data_movimento: string;
  tipo: string;
  quantita: number;
  costo_unitario: number | null;
}
interface TrattamentoRow {
  id: string;
  nome: string;
  categoria: string | null;
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
}
function eur(v: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

function lastNMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  now.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(d));
  }
  return out;
}

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--primary)",
];

function InsightsPage() {
  const sinceISO = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 5);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const sedute = useQuery({
    queryKey: ["insights", "sedute", sinceISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seduta")
        .select("data_seduta, data_esecuzione_effettiva, trattamento_id, completata")
        .gte("data_seduta", sinceISO)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as SedutaRow[];
    },
  });

  const piani = useQuery({
    queryKey: ["insights", "piani", sinceISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("piano_trattamento")
        .select("prezzo_finale, prezzo_totale, created_at, stato")
        .gte("created_at", sinceISO)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as PianoRow[];
    },
  });

  const movimenti = useQuery({
    queryKey: ["insights", "movimenti", sinceISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("magazzino_movimento")
        .select("data_movimento, tipo, quantita, costo_unitario")
        .gte("data_movimento", sinceISO)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as MovimentoRow[];
    },
  });

  const trattamenti = useQuery({
    queryKey: ["insights", "trattamenti_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trattamenti")
        .select("id, nome, categoria")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as TrattamentoRow[];
    },
  });

  const months = useMemo(() => lastNMonths(6), []);
  const trattMap = useMemo(() => {
    const m = new Map<string, TrattamentoRow>();
    (trattamenti.data ?? []).forEach((t) => m.set(t.id, t));
    return m;
  }, [trattamenti.data]);

  // Trend sedute completate per mese
  const trendSedute = useMemo(() => {
    const base = new Map(months.map((m) => [m, 0]));
    (sedute.data ?? []).forEach((s) => {
      if (!s.completata) return;
      const ref = s.data_esecuzione_effettiva ?? s.data_seduta;
      if (!ref) return;
      const k = monthKey(new Date(ref));
      if (base.has(k)) base.set(k, (base.get(k) ?? 0) + 1);
    });
    return months.map((m) => ({ mese: monthLabel(m), sedute: base.get(m) ?? 0 }));
  }, [sedute.data, months]);

  // Fatturato stimato per mese (piani creati)
  const trendFatturato = useMemo(() => {
    const base = new Map(months.map((m) => [m, 0]));
    (piani.data ?? []).forEach((p) => {
      const v = Number(p.prezzo_finale ?? p.prezzo_totale ?? 0);
      const k = monthKey(new Date(p.created_at));
      if (base.has(k)) base.set(k, (base.get(k) ?? 0) + v);
    });
    return months.map((m) => ({ mese: monthLabel(m), fatturato: Math.round(base.get(m) ?? 0) }));
  }, [piani.data, months]);

  // Costi magazzino (uscite/consumi)
  const trendCosti = useMemo(() => {
    const base = new Map(months.map((m) => [m, 0]));
    (movimenti.data ?? []).forEach((mv) => {
      // uscite: tipo che riduce stock (uso, scarto, rettifica negativa)
      const isUscita = ["uso", "scarto", "consumo", "rettifica_negativa"].includes(mv.tipo) || Number(mv.quantita) < 0;
      if (!isUscita) return;
      const costo = Math.abs(Number(mv.quantita)) * Number(mv.costo_unitario ?? 0);
      const k = monthKey(new Date(mv.data_movimento));
      if (base.has(k)) base.set(k, (base.get(k) ?? 0) + costo);
    });
    return months.map((m) => ({ mese: monthLabel(m), costi: Math.round(base.get(m) ?? 0) }));
  }, [movimenti.data, months]);

  // Mix categorie trattamenti (sedute completate)
  const mixCategorie = useMemo(() => {
    const counts = new Map<string, number>();
    (sedute.data ?? []).forEach((s) => {
      if (!s.completata || !s.trattamento_id) return;
      const t = trattMap.get(s.trattamento_id);
      const cat = t?.categoria || "Altro";
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [sedute.data, trattMap]);

  // Top trattamenti
  const topTrattamenti = useMemo(() => {
    const counts = new Map<string, number>();
    (sedute.data ?? []).forEach((s) => {
      if (!s.completata || !s.trattamento_id) return;
      counts.set(s.trattamento_id, (counts.get(s.trattamento_id) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([id, value]) => ({ nome: trattMap.get(id)?.nome ?? "—", value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [sedute.data, trattMap]);

  // Interpretazioni
  const totSedute = trendSedute.reduce((a, b) => a + b.sedute, 0);
  const totFatturato = trendFatturato.reduce((a, b) => a + b.fatturato, 0);
  const totCosti = trendCosti.reduce((a, b) => a + b.costi, 0);
  const marginePerc = totFatturato > 0 ? Math.round(((totFatturato - totCosti) / totFatturato) * 100) : null;

  const trendSeduteVar = (() => {
    if (trendSedute.length < 2) return 0;
    const last = trendSedute[trendSedute.length - 1].sedute;
    const prev = trendSedute[trendSedute.length - 2].sedute;
    if (prev === 0) return last > 0 ? 100 : 0;
    return Math.round(((last - prev) / prev) * 100);
  })();

  const loading = sedute.isLoading || piani.isLoading || movimenti.isLoading || trattamenti.isLoading;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">Insights</h1>
        <p className="text-sm text-muted-foreground">Andamento ultimi 6 mesi · sedute, fatturato stimato e costi magazzino</p>
      </header>

      {/* Riepilogo */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<Activity className="h-4 w-4" />}
          label="Sedute completate"
          value={String(totSedute)}
          delta={trendSeduteVar}
        />
        <SummaryCard
          icon={<Euro className="h-4 w-4" />}
          label="Fatturato stimato"
          value={eur(totFatturato)}
          hint="da piani creati"
        />
        <SummaryCard
          icon={<Package className="h-4 w-4" />}
          label="Costi magazzino"
          value={eur(totCosti)}
          hint={marginePerc !== null ? `margine ~ ${marginePerc}%` : undefined}
        />
      </div>

      {/* Trend sedute + fatturato */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sedute completate per mese</CardTitle>
            <CardDescription>
              {loading
                ? "Caricamento…"
                : totSedute === 0
                ? "Nessuna seduta completata negli ultimi 6 mesi."
                : trendSeduteVar > 0
                ? `In crescita: +${trendSeduteVar}% vs mese precedente.`
                : trendSeduteVar < 0
                ? `In calo: ${trendSeduteVar}% vs mese precedente.`
                : "Volume stabile rispetto al mese precedente."}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendSedute} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mese" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="sedute" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fatturato stimato per mese</CardTitle>
            <CardDescription>Somma dei prezzi finali dei piani creati nel mese.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendFatturato} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="mese" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                  formatter={(v: number) => eur(v)}
                />
                <Bar dataKey="fatturato" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Mix categorie + Top trattamenti */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mix categorie trattamenti</CardTitle>
            <CardDescription>
              {mixCategorie.length === 0
                ? "Nessun dato disponibile."
                : `Categoria predominante: ${mixCategorie[0].name}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {mixCategorie.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mixCategorie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}>
                    {mixCategorie.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top trattamenti</CardTitle>
            <CardDescription>I più eseguiti negli ultimi 6 mesi.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {topTrattamenti.length === 0 ? (
              <EmptyState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={topTrattamenti} margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="value" fill="var(--primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Costi magazzino */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Costi magazzino per mese</CardTitle>
          <CardDescription>
            {totCosti === 0
              ? "Nessun consumo registrato negli ultimi 6 mesi."
              : marginePerc !== null
              ? `Margine stimato: ${marginePerc}% (fatturato − costi prodotti).`
              : "Andamento dei costi prodotti consumati."}
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trendCosti} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mese" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                formatter={(v: number) => eur(v)}
              />
              <Bar dataKey="costi" fill="var(--chart-cost)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Nota: il fatturato è stimato dai piani trattamento creati e non sostituisce la contabilità fiscale.
      </p>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  delta,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number;
  hint?: string;
}) {
  const Trend = delta === undefined ? null : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const trendCls = delta === undefined ? "" : delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight">{value}</span>
          {Trend && (
            <span className={`flex items-center gap-1 text-xs ${trendCls}`}>
              <Trend className="h-3 w-3" />
              {Math.abs(delta!)}%
            </span>
          )}
        </div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Dati non ancora sufficienti.
    </div>
  );
}
