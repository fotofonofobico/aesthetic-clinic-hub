import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Risolve il logo studio in URL utilizzabile come <img src>.
 * `logo_url` in DB è uno storage path nel bucket `studio-assets`,
 * non un URL pubblico. Qui generiamo una signed URL valida 1h.
 */
export function useStudioLogoUrl(logoPath: string | null | undefined) {
  return useQuery({
    queryKey: ["studio_logo_signed", logoPath ?? null],
    enabled: !!logoPath,
    staleTime: 50 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      if (!logoPath) return null;
      // Se è già un URL assoluto, restituisci direttamente.
      if (/^https?:\/\//i.test(logoPath)) return logoPath;
      const { data, error } = await supabase.storage
        .from("studio-assets")
        .createSignedUrl(logoPath, 3600);
      if (error) return null;
      return data?.signedUrl ?? null;
    },
  });
}
