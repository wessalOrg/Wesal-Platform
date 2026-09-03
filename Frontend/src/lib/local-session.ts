import { getAccessToken } from "@/lib/auth-token";
import { getStoredAuth } from "@/lib/auth-storage";
import { GUEST_SESSION, type SessionState, type WesalRole } from "@/types/session";

type JwtClaims = {
  sub?: unknown;
  name?: unknown;
  email?: unknown;
  role?: unknown;
  Role?: unknown;
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function decodeJwtPayload(token: string): JwtClaims | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as JwtClaims;
  } catch {
    return null;
  }
}

function roleFromClaims(claims: JwtClaims | null): WesalRole | null {
  if (!claims) return null;
  const value =
    claims.role ??
    claims.Role ??
    (claims as Record<string, unknown>)[
      "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
    ];
  if (Array.isArray(value)) {
    return asString(value[0]);
  }
  return asString(value);
}

export function readLocalSession(): SessionState | null {
  const stored = getStoredAuth();
  const token = getAccessToken() || stored?.token || null;
  if (!token) return null;

  const claims = decodeJwtPayload(token);
  const role = roleFromClaims(claims) ?? stored?.user.role ?? null;
  const userName =
    stored?.user.name ?? asString(claims?.name) ?? stored?.user.email ?? null;

  return {
    isAuthenticated: true,
    role,
    userName,
  };
}

export function sessionOrGuest(session: SessionState | null): SessionState {
  return session ?? GUEST_SESSION;
}
