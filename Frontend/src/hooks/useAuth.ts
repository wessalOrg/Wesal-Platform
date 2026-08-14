"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearStoredAuth,
  getStoredAuth,
  type StoredAuth,
  type StoredUser,
} from "@/lib/auth-storage";

type AuthState = {
  isAuthenticated: boolean;
  hydrated: boolean;
  user: StoredUser | null;
  token: string | null;
  logout: () => void;
  refresh: () => void;
};

export function useAuth(): AuthState {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(() => {
    setAuth(getStoredAuth());
  }, []);

  useEffect(() => {
    refresh();
    setHydrated(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key === "wesal_auth") refresh();
    };

    const onAuthChange = () => refresh();

    window.addEventListener("storage", onStorage);
    window.addEventListener("wesal-auth-change", onAuthChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("wesal-auth-change", onAuthChange);
    };
  }, [refresh]);

  const logout = useCallback(() => {
    clearStoredAuth();
    refresh();
  }, [refresh]);

  return {
    isAuthenticated: hydrated && Boolean(auth?.token),
    hydrated,
    user: auth?.user ?? null,
    token: auth?.token ?? null,
    logout,
    refresh,
  };
}
