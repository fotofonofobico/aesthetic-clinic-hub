import { supabase } from "@/integrations/supabase/client";

/**
 * Crea un evento follow-up sul calendario se l'utente ha attivato l'opzione
 * nelle preferenze. Esecuzione silenziosa: errori loggati ma mai propagati.
 * Idempotente: non crea duplicati per la stessa seduta.
 */
export async function creaFollowupSePrevisto(opts: {
  user_id: string;
  paziente_id: string;
  seduta_id: string;
  data_seduta: Date;
  trattamento_nome?: string | null;
}): Promise<void> {
  try {
    const { data: prefs } = await supabase
      .from("calendario_preferenze")
      .select("followup_auto_attivo, followup_giorni_offset")
      .eq("user_id", opts.user_id)
      .maybeSingle();

    if (!prefs?.followup_auto_attivo) return;

    // Idempotenza: già esiste un follow-up per questa seduta?
    const { data: esistenti } = await supabase
      .from("evento_calendario")
      .select("id")
      .eq("seduta_id", opts.seduta_id)
      .eq("tipo", "follow_up")
      .limit(1);
    if (esistenti && esistenti.length > 0) return;

    const offset = prefs.followup_giorni_offset ?? 7;
    const data = new Date(opts.data_seduta);
    data.setDate(data.getDate() + offset);
    data.setHours(9, 0, 0, 0);

    await supabase.from("evento_calendario").insert({
      titolo: `Follow-up${opts.trattamento_nome ? `: ${opts.trattamento_nome}` : ""}`,
      tipo: "follow_up",
      data_inizio: data.toISOString(),
      paziente_id: opts.paziente_id,
      seduta_id: opts.seduta_id,
      created_by: opts.user_id,
      descrizione: `Promemoria automatico generato dopo la seduta del ${opts.data_seduta.toLocaleDateString("it-IT")}.`,
    });
  } catch (err) {
    console.warn("[calendario] creaFollowupSePrevisto: errore silenzioso", err);
  }
}
