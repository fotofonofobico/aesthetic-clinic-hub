// Edge function: elimina un utente (auth + profilo + ruoli).
// Solo i medici possono invocarla. Richiede JWT del chiamante.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Non autenticato" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verifica identità chiamante
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) return json({ error: "Token non valido" }, 401);
    const callerId = userRes.user.id;

    // Verifica ruolo medico
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "medico")
      .maybeSingle();
    if (!roleRow) return json({ error: "Operazione riservata ai medici" }, 403);

    // Payload
    const body = await req.json().catch(() => ({}));
    const targetId = body?.userId as string | undefined;
    if (!targetId) return json({ error: "userId mancante" }, 400);
    if (targetId === callerId) return json({ error: "Non puoi eliminare te stesso" }, 400);

    // Audit prima della cancellazione (mantiene tracciabilità)
    await admin.from("audit_log").insert({
      user_id: callerId,
      action: "user_deleted",
      entity_type: "user",
      entity_id: targetId,
      metadata: {},
    });

    // Cancella ruoli + profilo (le altre tabelle hanno solo riferimenti UUID
    // senza FK su auth.users: i record storici restano per audit).
    await admin.from("user_roles").delete().eq("user_id", targetId);
    await admin.from("profiles").delete().eq("user_id", targetId);

    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true });
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
