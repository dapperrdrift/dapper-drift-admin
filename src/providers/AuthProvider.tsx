import { useEffect, useState, useCallback, type ReactNode, useRef } from "react";
import { type AuthChangeEvent, type Session, type User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "@/contexts/auth-context";

type ExtendedAuthChangeEvent = AuthChangeEvent | "INITIAL_SESSION";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const adminCheckCacheRef = useRef<Record<string, boolean>>({});

  const checkAdmin = useCallback(async (userId: string): Promise<boolean> => {
    if (adminCheckCacheRef.current[userId] !== undefined) {
      return adminCheckCacheRef.current[userId];
    }

    try {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });

      if (error) {
        console.error("Failed to check admin role:", error.message);
        return false;
      }
      
      const hasRole = !!data;
      adminCheckCacheRef.current[userId] = hasRole;
      return hasRole;
    } catch (error) {
      console.error("Unexpected error checking admin role:", error);
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const applySession = async (nextSession: Session | null, event: ExtendedAuthChangeEvent) => {
      if (!isMounted) return;

      const validEvents = ["SIGNED_IN", "SIGNED_OUT", "USER_UPDATED", "INITIAL_SESSION"];
      if (!validEvents.includes(event)) {
        return;
      }

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        setLoading(true);
      }

      try {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          const adminResult = await checkAdmin(nextSession.user.id);
          if (isMounted) setIsAdmin(adminResult);
        } else {
          if (isMounted) setIsAdmin(false);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      applySession(nextSession, event);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session, "INITIAL_SESSION");
    }).catch(error => {
      console.error("Failed to load auth session:", error);
      if (isMounted) {
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [checkAdmin]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // onAuthStateChange clears loading for successful sign-in.
    if (error) setLoading(false);
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, isAdmin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}