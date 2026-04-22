import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ClipboardList, FileSignature, Syringe, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, hasRole, roles } = useAuth();
  const ruolo = hasRole("medico") ? "Medico (admin)" : roles[0] ? "Collaboratore" : "Nessun ruolo";

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Benvenuto/a</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {user?.email}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ruolo: <span className="font-medium text-foreground">{ruolo}</span>
        </p>
      </header>

      <section>
        <h2 className="font-display text-lg font-semibold">Iterazione 1 — in costruzione</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Le fondamenta sono pronte. Nei prossimi step costruiamo i moduli clinici.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            icon={<Users className="h-5 w-5" />}
            title="Pazienti"
            description="Anagrafica, codice fiscale opzionale, alert e flag rischio, soft-delete GDPR."
            status="next"
          />
          <ModuleCard
            icon={<ClipboardList className="h-5 w-5" />}
            title="Anamnesi"
            description="Modulare: generale, farmacologica, allergologica, estetica. Flag automatici."
            status="next"
          />
          <ModuleCard
            icon={<FileSignature className="h-5 w-5" />}
            title="Consensi"
            description="Firma grafometrica su tablet, archivio storico, collegabili a piano o seduta."
            status="next"
          />
          <ModuleCard
            icon={<Syringe className="h-5 w-5" />}
            title="Trattamenti & Piani"
            description="Catalogo, piani con sedute, ritocchi, follow-up clinici."
            status="next"
          />
          <ModuleCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Audit & sicurezza"
            description="Log accessi automatico, RLS attiva, ruoli medico/collaboratore."
            status="ready"
          />
        </div>
      </section>
    </div>
  );
}

function ModuleCard({
  icon,
  title,
  description,
  status,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: "ready" | "next" | "later";
}) {
  const badge =
    status === "ready"
      ? { label: "Attivo", className: "bg-success/15 text-success-foreground border-success/30" }
      : status === "next"
        ? { label: "Prossimo step", className: "bg-accent text-accent-foreground border-accent" }
        : { label: "Più avanti", className: "bg-muted text-muted-foreground border-border" };

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            {icon}
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge.className}`}>
            {badge.label}
          </span>
        </div>
        <CardTitle className="font-display text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
