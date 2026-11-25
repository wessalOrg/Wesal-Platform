import { AUTH_CHANGE_EVENT, getStoredAuth } from "@/lib/auth-storage";
import { getAccessToken } from "@/lib/auth-token";

/** Identity of one continuous login. Async consumers compare the instance, not just the user ID. */
export type AuthenticatedAccount = Readonly<{ userId: string; token: string }>;

let current: AuthenticatedAccount | null = null;
let listening = false;
const listeners = new Set<() => void>();

function synchronize() {
  try {
    const auth = getStoredAuth();
    const token = getAccessToken();
    const userId = auth?.user?.id?.trim();
    // A partial login/token transition must never fall back to the previous user.
    if (userId && token && token === auth?.token) {
      if (current?.userId !== userId || current.token !== token) current = { userId, token };
    } else {
      current = null;
    }
  } catch {
    // Unavailable browser storage cannot establish ownership of cached data.
    current = null;
  }
}

function onAuthChange() {
  synchronize();
  listeners.forEach((listener) => listener());
}

export function readAuthenticatedAccount(): AuthenticatedAccount | null {
  if (typeof window === "undefined") return null;
  if (!listening) {
    listening = true;
    window.addEventListener(AUTH_CHANGE_EVENT, onAuthChange);
    window.addEventListener("storage", onAuthChange);
  }
  synchronize();
  return current;
}

export function isCurrentAuthenticatedAccount(
  account: AuthenticatedAccount | null,
): account is AuthenticatedAccount {
  return account !== null && readAuthenticatedAccount() === account;
}

export function subscribeAuthenticatedAccount(listener: () => void): () => void {
  readAuthenticatedAccount();
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const serverAuthenticatedAccount = () => null;
