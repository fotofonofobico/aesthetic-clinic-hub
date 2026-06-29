// Edge function: serve il PDF di un consenso firmato dato un token di share.
// Valida token (esistenza, non scaduto, non revocato), logga l'accesso,
// poi restituisce metadati + signed URL del PDF.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return json({ error: "Token mancante" }, 400);
    }
    // Formato atteso: base64url (vedi src/lib/share-link.ts → randomToken).
    // 256 bit -> 43 caratteri base64url. Accettiamo 40-128 per sicurezza.
    if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) {
      return json({ error: "Token non valido" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error: linkErr } = await admin
      .from("consenso_share_link")
      .select("id, consenso_id, expires_at, revoked_at")
      .eq("token", token)
      .maybeSingle();

    if (linkErr) {
      console.error("share-consenso link lookup error", linkErr);
      return json({ error: "Errore interno del server" }, 500);
    }
    if (!link) return json({ error: "Link non valido" }, 404);
    if (link.revoked_at) return json({ error: "Link revocato" }, 410);
    if (new Date(link.expires_at) < new Date()) {
      return json({ error: "Link scaduto" }, 410);
    }

    const { data: consenso, error: cErr } = await admin
      .from("consenso_firmato")
      .select(
        "id, titolo_snapshot, testo_snapshot, versione_snapshot, categoria_snapshot, firmato_il, valido_fino_a, modalita_firma, firma_immagine, pdf_url, rifiutato, revocato_il, paziente_id",
      )
      .eq("id", link.consenso_id)
      .maybeSingle();

    if (cErr) {
      console.error("share-consenso consenso lookup error", cErr);
      return json({ error: "Errore interno del server" }, 500);
    }
    if (!consenso) return json({ error: "Consenso non trovato" }, 404);

    const { data: paz } = await admin
      .from("pazienti")
      .select("nome, cognome")
      .eq("id", consenso.paziente_id)
      .maybeSingle();

    let pdfSignedUrl: string | null = null;
    if (consenso.pdf_url) {
      const { data: signed } = await admin.storage
        .from("consensi-pdf")
        .createSignedUrl(consenso.pdf_url, 60 * 30);
      pdfSignedUrl = signed?.signedUrl ?? null;
    }

    // Log accesso (best effort)
    void admin.from("consenso_share_access_log").insert({
      share_id: link.id,
      ip: req.headers.get("x-forwarded-for") ?? null,
      user_agent: req.headers.get("user-agent") ?? null,
    });

    return json({
      paziente: paz ? `${paz.cognome} ${paz.nome}`.trim() : null,
      consenso: {
        id: consenso.id,
        titolo: consenso.titolo_snapshot,
        testo: consenso.testo_snapshot,
        versione: consenso.versione_snapshot,
        categoria: consenso.categoria_snapshot,
        firmatoIl: consenso.firmato_il,
        validoFinoA: consenso.valido_fino_a,
        modalitaFirma: consenso.modalita_firma,
        firmaImmagine: consenso.firma_immagine,
        rifiutato: consenso.rifiutato,
        revocato: !!consenso.revocato_il,
      },
      pdfUrl: pdfSignedUrl,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
