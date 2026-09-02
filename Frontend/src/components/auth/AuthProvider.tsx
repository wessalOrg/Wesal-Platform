"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clearAccessToken } from "@/lib/auth-token";
import { clearStoredAuth } from "@/lib/auth-storage";
import { fetchSession } from "@/services/session";
import { GUEST_SESSION, type SessionState } from "@/types/session";

type AuthContextValue = {
  session: SessionState;
  status: "loading" | "ready";
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>(GUEST_SESSION);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  const refreshSession = useCallback(async () => {
    const next = await fetchSession();
    setSession(next);
    setStatus("ready");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchSession().then((next) => {
      if (cancelled) return;
      setSession(next);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    clearAccessToken();
    clearStoredAuth();
    setSession(GUEST_SESSION);
    setStatus("ready");
  }, []);

  const value = useMemo(
    () => ({ session, status, refreshSession, logout }),
    [session, status, refreshSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      session: GUEST_SESSION,
      status: "ready",
      refreshSession: async () => undefined,
      logout: async () => undefined,
    };
  }
  return context;
}
