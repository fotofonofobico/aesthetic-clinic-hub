import * as React from "react";
import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useProfile, nomeVisualizzato } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Stethoscope,
  LayoutDashboard,
  Users,
  CalendarDays,
  FileSignature,
  Syringe,
  Package,
  Settings,
  LogOut,
  Menu,
  X,
  Tablet,
  BarChart3,
} from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/insights", label: "Insights", icon: <BarChart3 className="h-4 w-4" /> },
  { to: "/calendario", label: "Calendario", icon: <CalendarDays className="h-4 w-4" /> },
  { to: "/pazienti", label: "Pazienti", icon: <Users className="h-4 w-4" /> },
  { to: "/trattamenti", label: "Trattamenti", icon: <Syringe className="h-4 w-4" /> },
  { to: "/consensi", label: "Consensi", icon: <FileSignature className="h-4 w-4" /> },
  { to: "/magazzino", label: "Magazzino", icon: <Package className="h-4 w-4" /> },
  { to: "/firma", label: "Modalità firma", icon: <Tablet className="h-4 w-4" /> },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut, hasRole, roles } = useAuth();
  const { data: profilo } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/" });
  };

  const ruolo = hasRole("medico") ? "Medico" : roles[0] ? "Collaboratore" : "—";
  const nome = nomeVisualizzato(profilo, user?.email ?? "");
  const prefisso = hasRole("medico") ? "Dr. " : "";

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar md:flex md:flex-col">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-card/60 px-4 md:px-6">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Apri menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 md:ml-auto">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{prefisso}{nome}</p>
              <p className="text-xs text-muted-foreground leading-tight">{ruolo}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Esci</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );

  function SidebarContent({ onNavigate }: { onNavigate?: () => void } = {}) {
    return (
      <>
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <Link to="/dashboard" className="flex items-center gap-2" onClick={onNavigate}>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="font-display text-base font-semibold">Aesthetic Clinic Hub</span>
          </Link>
          {onNavigate && (
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-sidebar-accent md:hidden"
              onClick={onNavigate}
              aria-label="Chiudi"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            return (
              <div
                key={item.to}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors cursor-pointer",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                onClick={() => {
                  void navigate({ to: item.to });
                  onNavigate?.();
                }}
              >
                {item.icon}
                {item.label}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors cursor-pointer",
              location.pathname.startsWith("/impostazioni")
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
            onClick={() => {
              void navigate({ to: "/impostazioni/profilo" });
              onNavigate?.();
            }}
          >
            <Settings className="h-4 w-4" />
            Impostazioni
          </div>
        </div>
      </>
    );
  }
}
