import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "medico" | "collaboratore";

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  hasRole: (role: AppRole) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nome: string, cognome: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [roles, setRoles] = React.useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const bootstrappedRef = React.useRef(false);

  const loadRoles = React.useCallback(async (uid: string | undefined) => {
    if (!uid) {
      setRoles([]);
      return;
    }
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    if (error) {
      console.error("Errore caricamento ruoli:", error);
      setRoles([]);
      return;
    }
    setRoles((data ?? []).map((r) => r.role as AppRole));
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    // Listener registrato PRIMA di getSession.
    // Aggiorna sessione/utente/ruoli ma NON chiude isLoading: lo fa solo il bootstrap iniziale.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (cancelled) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        void loadRoles(newSession.user.id);
      } else {
        setRoles([]);
      }
    });

    // Bootstrap: aspettiamo SIA getSession() SIA loadRoles() prima di chiudere isLoading,
    // così _authenticated.tsx non triggera il redirect a /login mentre la sessione si idrata.
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await loadRoles(data.session.user.id);
      }
      if (!cancelled) {
        bootstrappedRef.current = true;
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadRoles]);

  const signIn = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = React.useCallback(
    async (email: string, password: string, nome: string, cognome: string) => {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { nome, cognome },
        },
      });
      if (error) throw error;
    },
    [],
  );

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshRoles = React.useCallback(async () => {
    await loadRoles(user?.id);
  }, [loadRoles, user?.id]);

  const hasRole = React.useCallback((role: AppRole) => roles.includes(role), [roles]);

  const value = React.useMemo<AuthState>(
    () => ({
      isAuthenticated: !!session,
      isLoading,
      user,
      session,
      roles,
      hasRole,
      signIn,
      signUp,
      signOut,
      refreshRoles,
    }),
    [session, isLoading, user, roles, hasRole, signIn, signUp, signOut, refreshRoles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve essere usato dentro <AuthProvider>");
  return ctx;
}
