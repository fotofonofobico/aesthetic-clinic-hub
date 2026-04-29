import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export interface Profilo {
  user_id: string;
  nome: string;
  cognome: string;
  qualifica: string | null;
  numero_albo: string | null;
  telefono: string | null;
  attivo: boolean;
}

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<Profilo | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome, cognome, qualifica, numero_albo, telefono, attivo")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profilo | null;
    },
  });
}

export function nomeVisualizzato(p: Profilo | null | undefined, fallback: string): string {
  if (!p) return fallback;
  const full = `${p.nome ?? ""} ${p.cognome ?? ""}`.trim();
  return full || fallback;
}

export function salutoOrario(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}
