import { getAuthPersistenceStore } from "@/lib/auth-persist";

const TOKEN_KEY = "wesal-access-token";

function readToken(store: Storage): string | null {
  try {
    return store.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  // Prefer the active preference store, then fall back so existing sessions keep working.
  const preferred = readToken(getAuthPersistenceStore());
  if (preferred) return preferred;
  const local = readToken(window.localStorage);
  if (local) return local;
  return readToken(window.sessionStorage);
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  const store = getAuthPersistenceStore();
  const other =
    store === window.localStorage ? window.sessionStorage : window.localStorage;
  try {
    store.setItem(TOKEN_KEY, token);
    other.removeItem(TOKEN_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
