import { supabase } from "@/integrations/supabase/client";

/**
 * Genera un token sicuro casuale (256 bit, base64url).
 * Non lascia mai il client: viene salvato così com'è in DB e servito poi
 * via URL pubblico (`/share/consenso/:token`) — l'autenticazione è il token stesso.
 */
function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface ShareLinkOptions {
  consensoId: string;
  /** TTL in ore, default 72 (3 giorni). */
  ttlHours?: number;
}

export interface ShareLinkResult {
  id: string;
  token: string;
  url: string;
  expiresAt: string;
}

/**
 * Crea uno share link temporaneo per un consenso firmato e ne restituisce
 * l'URL pubblico assoluto (basato su `window.location.origin`).
 */
export async function createShareLink({
  consensoId,
  ttlHours = 72,
}: ShareLinkOptions): Promise<ShareLinkResult> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("consenso_share_link")
    .insert({
      consenso_id: consensoId,
      token,
      expires_at: expiresAt,
    })
    .select("id, token, expires_at")
    .single();

  if (error) throw error;

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return {
    id: data.id,
    token: data.token,
    url: `${origin}/share/consenso/${data.token}`,
    expiresAt: data.expires_at,
  };
}

export async function revokeShareLink(id: string): Promise<void> {
  const { error } = await supabase
    .from("consenso_share_link")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
