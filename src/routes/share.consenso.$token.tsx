import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ShieldAlert, FileText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/share/consenso/$token")({
  component: ShareConsensoPage,
});

interface ConsensoData {
  verifica?: boolean;
  paziente: string | null;
  consenso: {
    id: string;
    titolo: string;
    testo: string;
    versione: string;
    categoria: string;
    firmatoIl: string;
    validoFinoA: string | null;
    modalitaFirma: string;
    firmaImmagine: string | null;
    rifiutato: boolean;
    revocato: boolean;
  };
  pdfUrl: string | null;
}

function ShareConsensoPage() {
  const { token } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConsensoData | null>(null);

  // Un hash SHA-256 esadecimale (64 caratteri) indica una richiesta di
  // verifica autenticità (QR code stampato sul PDF).
  const isHashVerify = /^[a-f0-9]{64}$/i.test(token);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const qs = isHashVerify
          ? `hash=${encodeURIComponent(token)}`
          : `token=${encodeURIComponent(token)}`;
        const r = await fetch(`${supabaseUrl}/functions/v1/share-consenso?${qs}`, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          },
        });
        const body = await r.json();
        if (!r.ok) {
          setError(body.error ?? "Errore");
        } else {
          setData(body as ConsensoData);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [token, isHashVerify]);

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
        <header className="text-center">
          <h1 className="font-display text-2xl font-semibold">
            {isHashVerify ? "Verifica autenticità documento" : "Consenso firmato"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isHashVerify
              ? "Verifica basata sull'hash di integrità"
              : "Documento condiviso in sola lettura"}
          </p>
        </header>

        {loading && (
          <Card>
            <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Caricamento…
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-8">
              <ShieldAlert className="h-6 w-6 text-destructive" />
              <div>
                <div className="font-semibold text-destructive">
                  {isHashVerify ? "Documento non trovato o non verificabile" : "Link non disponibile"}
                </div>
                <div className="text-sm text-muted-foreground">{error}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {data && isHashVerify && (
          <Card className="border-success/40 bg-success/5">
            <CardHeader>
              <CardTitle className="font-display flex flex-wrap items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-success-foreground" />
                Documento autentico
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Questo documento corrisponde a un consenso firmato registrato nel sistema.
              </p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Titolo: </span>
                <span className="font-semibold">
                  {data.consenso.titolo} (v{data.consenso.versione})
                </span>
              </div>
              {data.paziente && (
                <div>
                  <span className="text-muted-foreground">Paziente: </span>
                  {data.paziente}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Data firma: </span>
                {new Date(data.consenso.firmatoIl).toLocaleString("it-IT", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </div>
              <div>
                <span className="text-muted-foreground">Categoria: </span>
                {data.consenso.categoria}
              </div>
              {data.consenso.rifiutato && (
                <div className="font-semibold text-warning">
                  Il paziente non ha acconsentito.
                </div>
              )}
              {data.consenso.revocato && (
                <div className="font-semibold text-warning">
                  Consenso successivamente revocato.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {data && !isHashVerify && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display flex flex-wrap items-center gap-2">
                {data.consenso.rifiutato || data.consenso.revocato ? (
                  <ShieldAlert className="h-5 w-5 text-warning" />
                ) : (
                  <ShieldCheck className="h-5 w-5 text-success-foreground" />
                )}
                {data.consenso.titolo}
                <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  v{data.consenso.versione}
                </span>
              </CardTitle>
              {data.paziente && (
                <p className="text-sm text-muted-foreground">Paziente: {data.paziente}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Firmato il{" "}
                {new Date(data.consenso.firmatoIl).toLocaleString("it-IT", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {data.consenso.validoFinoA
                  ? ` · valido fino al ${new Date(data.consenso.validoFinoA).toLocaleDateString("it-IT")}`
                  : ""}
                {data.consenso.rifiutato ? " · NON ACCONSENTITO" : ""}
                {data.consenso.revocato ? " · REVOCATO" : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-96 overflow-auto rounded-md border border-border bg-muted/40 p-4 text-sm">
                <p className="whitespace-pre-wrap">{data.consenso.testo}</p>
              </div>

              {data.consenso.modalitaFirma === "tablet" && data.consenso.firmaImmagine && (
                <div>
                  <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Firma
                  </div>
                  <img
                    src={data.consenso.firmaImmagine}
                    alt="firma"
                    className="h-32 w-full rounded border border-border bg-card object-contain"
                  />
                </div>
              )}

              {data.pdfUrl && (
                <Button asChild className="w-full">
                  <a href={data.pdfUrl} target="_blank" rel="noreferrer">
                    <FileText className="h-4 w-4" />
                    Apri / scarica PDF
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

