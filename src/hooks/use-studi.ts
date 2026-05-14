import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Studio {
  id: string;
  nome: string;
  indirizzo: string | null;
  citta: string | null;
  attivo: boolean;
  created_at: string;
}

export function useStudi() {
  return useQuery({
    queryKey: ["studi"],
    queryFn: async (): Promise<Studio[]> => {
      const { data, error } = await supabase
        .from("studio" as never)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Studio[];
    },
  });
}
