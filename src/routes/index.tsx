import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Stethoscope, FileSignature, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void navigate({ to: "/dashboard" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-semibold tracking-tight">
              Aesthetic Clinic Hub
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Accedi</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <section className="max-w-3xl">
          <p className="mb-4 inline-block rounded-full border border-accent bg-accent/40 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-foreground">
            Gestionale clinico
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-6xl">
            La cartella clinica del tuo studio di medicina estetica.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground md:text-xl">
            Pazienti, anamnesi, consensi firmati su tablet, piani di trattamento e
            follow-up. Tutto in un'unica piattaforma conforme GDPR, pensata per il
            lavoro quotidiano in studio.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/login">Accedi al gestionale</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={<Users className="h-5 w-5" />}
            title="Pazienti & anamnesi"
            description="Anagrafica completa, anamnesi modulare con flag automatici di rischio."
          />
          <FeatureCard
            icon={<FileSignature className="h-5 w-5" />}
            title="Consensi firmati"
            description="Firma grafometrica su tablet, archivio storico, validità medico-legale."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Conformità GDPR"
            description="Dati su Cloud europeo, log accessi, conservazione cartella 10 anni."
          />
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Aesthetic Clinic Hub — versione MVP
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
