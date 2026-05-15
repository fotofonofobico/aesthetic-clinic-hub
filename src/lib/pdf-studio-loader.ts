// Carica una sola volta i dati dello studio + il logo come dataURL,
// per disegnarli nelle intestazioni PDF (carta intestata).
// Cache in memoria con TTL: i PDF vengono spesso generati a raffica
// (anamnesi + più consensi nella stessa sessione di firma).
import { supabase } from "@/integrations/supabase/client";
import type { StudioInfo } from "@/hooks/use-studio-info";

export interface StudioForPdf {
  studio: StudioInfo | null;
  logoDataUrl: string | null;
}

let cache: { data: StudioForPdf; expiresAt: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export function invalidateStudioPdfCache() {
  cache = null;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function loadStudioForPdf(): Promise<StudioForPdf> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  let studio: StudioInfo | null = null;
  let logoDataUrl: string | null = null;

  try {
    const { data } = await supabase
      .from("studio_info")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    studio = (data as StudioInfo | null) ?? null;
  } catch {
    studio = null;
  }

  if (studio?.logo_url) {
    try {
      const { data: signed } = await supabase.storage
        .from("studio-assets")
        .createSignedUrl(studio.logo_url, 3600);
      const url = signed?.signedUrl;
      if (url) {
        const res = await fetch(url);
        if (res.ok) {
          const blob = await res.blob();
          logoDataUrl = await blobToDataUrl(blob);
        }
      }
    } catch {
      logoDataUrl = null;
    }
  }

  cache = { data: { studio, logoDataUrl }, expiresAt: Date.now() + TTL_MS };
  return cache.data;
}
