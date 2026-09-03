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
import { AUTH_CHANGE_EVENT, clearAuthSession } from "@/lib/auth-storage";
import { getAccessToken } from "@/lib/auth-token";
import { readLocalSession } from "@/lib/local-session";
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
  /** Overlay display name so header/forms update before `/session` knows. */
  applyIdentity: (patch: { userName?: string | null }) => void;
  /** Apply login/register identity immediately so the navbar does not wait on `/session`. */
  applyLocalSession: (session?: SessionState) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>(GUEST_SESSION);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const sessionEpochRef = useRef(0);
  const loggingOutRef = useRef(false);

  const applySession = useCallback((next: SessionState, epoch: number) => {
    if (epoch !== sessionEpochRef.current) return;
    setSession(next);
    if (!next.isAuthenticated) setNameOverride(null);
    setStatus("ready");
  }, []);

  const applyLocalSession = useCallback(
    (session?: SessionState) => {
      if (loggingOutRef.current) return;
      const epoch = ++sessionEpochRef.current;
      applySession(session ?? readLocalSession() ?? GUEST_SESSION, epoch);
    },
    [applySession],
  );

  const refreshSession = useCallback(async () => {
    if (loggingOutRef.current) return;
    const epoch = ++sessionEpochRef.current;
    const next = await fetchSession();
    applySession(next, epoch);
  }, [applySession]);

  useEffect(() => {
    let cancelled = false;
    const local = readLocalSession();
    if (local) {
      applySession(local, ++sessionEpochRef.current);
    }

    const epoch = ++sessionEpochRef.current;
    void fetchSession().then((next) => {
      if (cancelled) return;
      applySession(next, epoch);
    });

    return () => {
      cancelled = true;
    };
  }, [applySession]);

  useEffect(() => {
    const syncFromStorage = () => {
      if (loggingOutRef.current) return;
      const local = readLocalSession();
      if (local) {
        applyLocalSession(local);
        void refreshSession();
        return;
      }
      sessionEpochRef.current += 1;
      setNameOverride(null);
      setSession(GUEST_SESSION);
      setStatus("ready");
    };

    window.addEventListener(AUTH_CHANGE_EVENT, syncFromStorage);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [applyLocalSession, refreshSession]);

  const applyIdentity = useCallback((patch: { userName?: string | null }) => {
    if (patch.userName === undefined) return;
    setNameOverride(patch.userName?.trim() || null);
  }, []);

  const resetToGuest = useCallback(() => {
    clearAuthSession();
    setNameOverride(null);
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

  const viewedSession = useMemo<SessionState>(
    () => ({
      ...session,
      userName: nameOverride ?? session.userName,
    }),
    [nameOverride, session],
  );

  const value = useMemo(
    () => ({
      session: viewedSession,
      status,
      isLoggingOut,
      refreshSession,
      logout,
      applyIdentity,
      applyLocalSession,
    }),
    [viewedSession, status, isLoggingOut, refreshSession, logout, applyIdentity, applyLocalSession],
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
      applyIdentity: () => undefined,
      applyLocalSession: () => undefined,
    };
  }
  return context;
}
