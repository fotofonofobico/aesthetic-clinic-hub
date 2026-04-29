import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useKpiMese } from "@/hooks/use-kpi-mese";

export function KpiGriglia() {
  const { data, loading } = useKpiMese();

  return (
    <div className="grid grid-cols-2 gap-3">
      <KpiCard label="Nuovi pazienti / mese" value={data.nuoviPazienti} loading={loading} />
      <KpiCard
        label="Trattamenti / mese"
        value={data.trattamentiCompletati}
        loading={loading}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | null;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        {loading ? (
          <Skeleton className="h-9 w-16" />
        ) : value === null ? (
          <p className="text-sm text-muted-foreground">Nessun dato</p>
        ) : (
          <p className="font-display text-3xl font-semibold tabular-nums">{value}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
