import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { cleanupFirmaSessioniScadute } from "@/lib/cleanup";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Pagina non trovata</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La pagina che stai cercando non esiste o è stata spostata.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Torna alla home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Aesthetic Clinic Hub" },
      {
        name: "description",
        content:
          "Gestionale clinico per studi di medicina estetica: pazienti, anamnesi, consensi, piani di trattamento.",
      },
      { name: "author", content: "Aesthetic Clinic Hub" },
      { property: "og:title", content: "Aesthetic Clinic Hub" },
      { property: "og:description", content: "Aesthetic Clinic Hub is a web and mobile application for managing aesthetic medicine practices." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Aesthetic Clinic Hub" },
      { name: "description", content: "Aesthetic Clinic Hub is a web and mobile application for managing aesthetic medicine practices." },
      { name: "twitter:description", content: "Aesthetic Clinic Hub is a web and mobile application for managing aesthetic medicine practices." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/gH4oDAtr4SYbsT9s5nhXS2sWo672/social-images/social-1781546893827-ChatGPT_Image_15_giu_2026,_20_06_51.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/gH4oDAtr4SYbsT9s5nhXS2sWo672/social-images/social-1781546893827-ChatGPT_Image_15_giu_2026,_20_06_51.webp" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient());
  const router = useRouter();

  // Invalida cache al cambio di sessione (login/logout/utente cambiato).
  // Usa clear() invece di invalidateQueries() per evitare tempeste di refetch
  // (realtime + dashboard + tabs). TOKEN_REFRESHED è solo rinnovo bearer per
  // lo stesso utente: non invalidiamo nulla.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        queryClient.clear();
        void router.invalidate();
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [queryClient, router]);

  // Pulizia una tantum sessioni firma scadute (silenziosa)
  useEffect(() => {
    cleanupFirmaSessioniScadute().catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
