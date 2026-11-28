import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

import { endDemo, isDemo, subscribeDemo } from "@/demo/demo-session";
import { clearDemoData, demoUser } from "@/demo/demo-store";
import { supabase } from "@/integrations/supabase/client";

export interface AuthUser {
  id: string;
  email: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: User | null): AuthUser | null {
  return user ? { id: user.id, email: user.email ?? null } : null;
}

/** In demo mode the demo person is "signed in"; otherwise the real session's user. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const realUser = useRef<AuthUser | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const current = () => (isDemo() ? demoUser() : null) ?? realUser.current;

    // Demo mode doesn't wait for Supabase.
    if (isDemo()) {
      setUser(current());
      setIsLoading(false);
    }

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      realUser.current = error ? null : toAuthUser(data.user);
      setUser(current());
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;

      realUser.current = toAuthUser(session?.user ?? null);
      // A real sign-in ends demo mode.
      if (event === "SIGNED_IN" && session && isDemo()) {
        endDemo();
        clearDemoData();
      }
      setUser(current());
      setIsLoading(false);
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });

    const unsubscribeDemo = subscribeDemo(() => {
      setUser(current());
      void router.invalidate();
      void queryClient.invalidateQueries();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      unsubscribeDemo();
    };
  }, [queryClient, router]);

  return <AuthContext.Provider value={{ user, isLoading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
