import { supabase } from "@/integrations/supabase/client";

/**
 * Pulisce le sessioni firma scadute o cancellate più vecchie di 30 giorni.
 * Fire-and-forget: chiamare all'avvio dell'app.
 */
export async function cleanupFirmaSessioniScadute(): Promise<void> {
  const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from("firma_sessione")
    .delete()
    .in("stato", ["expired", "cancelled"])
    .lt("created_at", limite);
}
