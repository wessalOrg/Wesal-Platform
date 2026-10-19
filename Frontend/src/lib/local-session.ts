import { roleFromAccountSignals } from "@/lib/account-role";
import { getAccessToken } from "@/lib/auth-token";
import { getStoredAuth } from "@/lib/auth-storage";
import type { SessionState, WesalRole } from "@/types/session";

type JwtClaims = {
  sub?: unknown;
  name?: unknown;
  email?: unknown;
  role?: unknown;
  Role?: unknown;
  exp?: unknown;
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

/**
 * JWT `exp` is seconds since epoch. An expired token is a dead session: keeping it around
 * leaves the UI "authenticated" with credentials the API rejects (401), so every protected
 * action fails until the user signs in again.
 */
function isExpiredToken(claims: JwtClaims | null): boolean {
  const exp = (claims as Record<string, unknown> | null)?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return false;
  return Date.now() >= exp * 1000;
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
  if (isExpiredToken(claims)) {
    return null;
  }

  const role =
    roleFromAccountSignals(
      roleFromClaims(claims) ?? stored?.user.role,
      stored?.user.accountType,
    );
  const userName =
    stored?.user.name ?? asString(claims?.name) ?? stored?.user.email ?? null;

  return {
    isAuthenticated: true,
    role,
    userName,
  };
}
