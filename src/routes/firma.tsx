import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useStudioInfo } from "@/hooks/use-studio-info";
import { useStudioLogoUrl } from "@/hooks/use-studio-logo-url";
import { useProfile, nomeVisualizzato } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Stethoscope, Tablet, Wifi } from "lucide-react";
import { useSessioniInArrivo, type FirmaSessioneRow } from "@/lib/firma-sessione";
import { TabletPazienteSignDialog } from "@/components/firma/tablet-paziente-sign-dialog";

export const Route = createFileRoute("/firma")({
  component: ModalitaFirmaPage,
});

function ModalitaFirmaPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const { data: profilo } = useProfile();
  const { data: studio } = useStudioInfo();
  const { data: logoUrl } = useStudioLogoUrl(studio?.logo_url);


  const [activeRow, setActiveRow] = useState<FirmaSessioneRow | null>(null);
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => new Set());
  const sessioni = useSessioniInArrivo(user?.id ?? null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({ to: "/login" });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Auto-apertura della prima sessione pending in arrivo
  useEffect(() => {
    if (activeRow) return;
    const next = sessioni.find((s) => s.stato === "pending" && !completedIds.has(s.id));
    if (next) setActiveRow(next);
  }, [sessioni, activeRow, completedIds]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Caricamento…</div>
      </div>
    );
  }

  const nomeMedico = nomeVisualizzato(profilo, user?.email ?? "");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-background via-card to-muted">
      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wifi className="h-4 w-4 text-success" />
          <span>Connesso</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void navigate({ to: "/dashboard" });
          }}
        >
          <ArrowLeft className="h-4 w-4" />
          Esci da modalità firma
        </Button>
      </div>

      {/* Schermo attesa */}
      <div className="flex flex-col items-center px-6 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-primary">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo studio" className="h-full w-full object-contain" />
          ) : (
            <Stethoscope className="h-10 w-10" />
          )}
        </div>


        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {studio?.ragione_sociale ?? "Modalità firma"}
        </h1>
        <p className="mt-3 max-w-md text-balance text-base text-muted-foreground">
          Pronto a ricevere documenti da firmare. Tieni il dispositivo a portata e consegnalo
          al paziente quando arriva una richiesta.
        </p>

        <div className="mt-10 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm">
          <Tablet className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Operatore attivo:</span>
          <span className="font-medium">{nomeMedico}</span>
        </div>

        {sessioni.length > 1 && !activeRow && (
          <p className="mt-4 text-xs text-muted-foreground">
            {sessioni.length} sessioni in coda
          </p>
        )}
      </div>

      <TabletPazienteSignDialog
        open={!!activeRow}
        row={activeRow}
        onCompleted={() => {
          setCompletedIds((cur) => {
            const next = new Set(cur);
            if (activeRow) next.add(activeRow.id);
            return next;
          });
          setActiveRow(null);
        }}
      />
    </div>
  );
}
