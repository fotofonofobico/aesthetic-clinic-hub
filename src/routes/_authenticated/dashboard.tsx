import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AgendaSection } from "@/components/dashboard/agenda-section";
import { AzioniRapide } from "@/components/dashboard/azioni-rapide";
import { AlertsSection } from "@/components/dashboard/alerts-section";
import { KpiGriglia } from "@/components/dashboard/kpi-griglia";
import { AttivitaRecente } from "@/components/dashboard/attivita-recente";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, hasRole, roles } = useAuth();
  const ruolo = hasRole("medico") ? "Medico" : roles[0] ? "Collaboratore" : "—";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {user?.email}
        </h1>
        <p className="text-xs text-muted-foreground">{ruolo}</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <AgendaSection />
        <div className="space-y-4">
          <AzioniRapide />
          <AlertsSection />
          <KpiGriglia />
        </div>
      </div>

      <AttivitaRecente />
    </div>
  );
}
