import { clearAccessToken } from "@/lib/auth-token";
import {
  buildHallDetailsPath,
  withBookingIntent,
} from "@/lib/booking-intent";

const AUTH_STORAGE_KEY = "wesal_auth";
export const AUTH_CHANGE_EVENT = "wesal-auth-change";

export type StoredUser = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
};

export type StoredAuth = {
  token: string;
  user: StoredUser;
};

export function getStoredAuth(): StoredAuth | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setStoredAuth(auth: StoredAuth): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function clearStoredAuth(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

/** Clears access token + persisted auth payload. Does not touch unrelated storage. */
export function clearAuthSession(): void {
  clearAccessToken();
  clearStoredAuth();
}

/** Keeps navbar identity in sync after a Regular User profile save. */
export function patchStoredUser(patch: Partial<StoredUser>): void {
  const current = getStoredAuth();
  if (!current) return;

  const nextUser: StoredUser = { ...current.user };
  if (patch.id) nextUser.id = patch.id;
  if (typeof patch.name === "string") nextUser.name = patch.name;
  if (typeof patch.email === "string") nextUser.email = patch.email;
  if (typeof patch.phone === "string") nextUser.phone = patch.phone;
  if (typeof patch.role === "string") nextUser.role = patch.role;

  setStoredAuth({ ...current, user: nextUser });
}

const BOOKING_HALL_KEY = "wesal_booking_hall";
const BOOKING_RETURN_KEY = "wesal_booking_return";

/**
 * SRS redirect: /register?redirect=/halls/{id}&action=book
 */
export function buildRegisterRedirectPath(hallId: string): string {
  const hallPath = buildHallDetailsPath(hallId);
  return `/register?redirect=${encodeURIComponent(hallPath)}&action=book`;
}

/**
 * Login redirect with optional booking resume intent.
 */
export function buildLoginRedirectPath(hallId: string, withBookingIntent = false): string {
  const hallPath = buildHallDetailsPath(hallId, withBookingIntent);
  const base = `/login?redirect=${encodeURIComponent(hallPath)}`;
  return withBookingIntent ? `${base}&action=book` : base;
}

/** Persists hall context so booking can resume after registration/login. */
export function saveBookingHallContext(hallId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(BOOKING_HALL_KEY, hallId);
  window.sessionStorage.setItem(
    BOOKING_RETURN_KEY,
    buildHallDetailsPath(hallId, true),
  );
}

export function getBookingHallContext(): { hallId: string; returnPath: string } | null {
  if (typeof window === "undefined") return null;

  const hallId = window.sessionStorage.getItem(BOOKING_HALL_KEY);
  const returnPath = window.sessionStorage.getItem(BOOKING_RETURN_KEY);
  if (!hallId || !returnPath) return null;

  return { hallId, returnPath };
}

/**
 * Resolve post-auth destination from redirect param, action flag, or sessionStorage.
 * Only same-origin relative paths are allowed (blocks open redirects).
 */
export function resolveAuthRedirect(
  redirectParam?: string,
  actionParam?: string,
): string {
  let path: string | undefined;

  if (redirectParam?.trim()) {
    try {
      path = decodeURIComponent(redirectParam);
    } catch {
      path = redirectParam;
    }
  } else {
    path = getBookingHallContext()?.returnPath;
  }

  path = sanitizeInternalPath(path);
  if (!path) return "/";

  const wantsBooking =
    actionParam === "book" ||
    path.includes("action=book") ||
    path.includes("book=1");

  const basePath = path.split("?")[0] ?? path;
  return wantsBooking ? withBookingIntent(basePath) : path;
}

/** Allow only in-app relative paths like `/halls/1` — reject absolute/protocol URLs. */
export function sanitizeInternalPath(path?: string | null): string | undefined {
  if (!path) return undefined;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return undefined;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return undefined;
  if (trimmed.includes("://")) return undefined;
  if (/[\x00-\x1f]/.test(trimmed)) return undefined;
  return trimmed;
}


export function clearBookingHallContext(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(BOOKING_HALL_KEY);
  window.sessionStorage.removeItem(BOOKING_RETURN_KEY);
}
