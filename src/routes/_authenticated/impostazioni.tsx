import { createFileRoute, Outlet, Link, useLocation, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/impostazioni")({
  component: ImpostazioniLayout,
  beforeLoad: ({ location }) => {
    if (location.pathname === "/impostazioni") {
      throw redirect({ to: "/impostazioni/profilo" });
    }
  },
});

interface Tab {
  to: string;
  label: string;
  medicoOnly?: boolean;
}

const TABS: Tab[] = [
  { to: "/impostazioni/profilo", label: "Il mio profilo" },
  { to: "/impostazioni/preferenze", label: "Preferenze" },
  { to: "/impostazioni/studio", label: "Studio", medicoOnly: true },
  { to: "/impostazioni/utenti", label: "Utenti & Ruoli", medicoOnly: true },
  { to: "/impostazioni/backup", label: "Backup & Export", medicoOnly: true },
];

function ImpostazioniLayout() {
  const { hasRole } = useAuth();
  const location = useLocation();
  const isMedico = hasRole("medico");
  const tabs = TABS.filter((t) => !t.medicoOnly || isMedico);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          Impostazioni
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestisci profilo, studio, utenti e preferenze.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => {
          const active = location.pathname === t.to;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <div>
        <Outlet />
      </div>
    </div>
  );
}
