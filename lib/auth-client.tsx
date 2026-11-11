"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Session } from "@supabase/supabase-js";

type AuthUser = { id: string };
type AuthContextType = {
  ready: boolean;
  authenticated: boolean;
  user: AuthUser | null;
  getAccessToken: () => Promise<string | null>;
  logout: () => Promise<void>;
  login: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabaseBrowser.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: { subscription } } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabaseBrowser.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const logout = useCallback(async () => {
    await supabaseBrowser.auth.signOut();
    router.replace("/login");
  }, [router]);

  const login = useCallback(() => {
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider value={{
      ready,
      authenticated: !!session,
      user: session?.user ? { id: session.user.id } : null,
      getAccessToken,
      logout,
      login,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
