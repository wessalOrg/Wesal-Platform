"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { clearAuthSession } from "@/lib/auth-storage";
import { getAccessToken } from "@/lib/auth-token";
import { logoutAccount } from "@/services/auth";
import { fetchSession } from "@/services/session";
import { GUEST_SESSION, type SessionState } from "@/types/session";

const GUEST_HOME = "/";

export type LogoutOptions = {
  /** Default true. Pass false when clearing a dead session in place (e.g. hall 401). */
  redirect?: boolean;
};

type AuthContextValue = {
  session: SessionState;
  status: "loading" | "ready";
  isLoggingOut: boolean;
  refreshSession: () => Promise<void>;
  logout: (options?: LogoutOptions) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>(GUEST_SESSION);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const sessionEpochRef = useRef(0);
  const loggingOutRef = useRef(false);

  const applySession = useCallback((next: SessionState, epoch: number) => {
    if (epoch !== sessionEpochRef.current) return;
    setSession(next);
    setStatus("ready");
  }, []);

  const refreshSession = useCallback(async () => {
    if (loggingOutRef.current) return;
    const epoch = sessionEpochRef.current;
    const next = await fetchSession();
    applySession(next, epoch);
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;
    const epoch = sessionEpochRef.current;

    void fetchSession().then((next) => {
      if (cancelled) return;
      applySession(next, epoch);
    });

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  const resetToGuest = useCallback(() => {
    clearAuthSession();
    setSession(GUEST_SESSION);
    setStatus("ready");
  }, []);

  const logout = useCallback(
    async (options?: LogoutOptions) => {
      if (loggingOutRef.current) return;

      loggingOutRef.current = true;
      setIsLoggingOut(true);
      sessionEpochRef.current += 1;

      try {
        if (getAccessToken()) {
          await logoutAccount();
        }
      } catch {
        // Remote logout can fail or 401; local session must still become Guest.
      } finally {
        resetToGuest();
        loggingOutRef.current = false;
        setIsLoggingOut(false);
        if (options?.redirect !== false) {
          router.replace(GUEST_HOME);
        }
      }
    },
    [resetToGuest, router],
  );

  const value = useMemo(
    () => ({ session, status, isLoggingOut, refreshSession, logout }),
    [session, status, isLoggingOut, refreshSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      session: GUEST_SESSION,
      status: "ready",
      isLoggingOut: false,
      refreshSession: async () => undefined,
      logout: async () => undefined,
    };
  }
  return context;
}
