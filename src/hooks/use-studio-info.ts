import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StudioInfo {
  id: string;
  ragione_sociale: string | null;
  partita_iva: string | null;
  codice_fiscale: string | null;
  indirizzo: string | null;
  citta: string | null;
  cap: string | null;
  provincia: string | null;
  telefono: string | null;
  email: string | null;
  pec: string | null;
  sito_web: string | null;
  logo_url: string | null;
  direttore_sanitario: string | null;
}

export function useStudioInfo() {
  return useQuery({
    queryKey: ["studio_info"],
    queryFn: async (): Promise<StudioInfo | null> => {
      const { data, error } = await supabase
        .from("studio_info")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as StudioInfo | null;
    },
  });
}
