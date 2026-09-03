import type { SessionState } from "@/types/session";

export type HallOwnershipInput = {
  isOwner?: boolean;
};

export type HallActionPermissions = {
  authReady: boolean;
  isGuest: boolean;
  isOwnHall: boolean;
  canBook: boolean;
  canComment: boolean;
  canRate: boolean;
  canContactOwner: boolean;
};

type HallActionPolicyInput = {
  session: SessionState;
  authReady: boolean;
  isOwnHall: boolean;
};

function normalizeRole(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase();
}

function isHallOwnerRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "hallowner";
}

function isRegisteredUserRole(role: string | null | undefined): boolean {
  const value = normalizeRole(role);
  return value === "registereduser" || value === "regularuser";
}

function isAdminRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "admin";
}

/**
 * Frontend policy for hall interactive actions.
 * Mirrors backend authorization; not a security boundary.
 *
 * Ownership only applies while authenticated — a Guest must never inherit
 * a stale `isOwner` flag from a previous hall fetch.
 */
export function getHallActionPermissions({
  session,
  authReady,
  isOwnHall,
}: HallActionPolicyInput): HallActionPermissions {
  const isGuest = authReady && !session.isAuthenticated;
  const authenticated = authReady && session.isAuthenticated;
  const ownsHall = authenticated && isOwnHall;
  const registered = isRegisteredUserRole(session.role);
  const hallOwner = isHallOwnerRole(session.role);
  const admin = isAdminRole(session.role);

  return {
    authReady,
    isGuest,
    isOwnHall: ownsHall,
    canBook: authenticated && !ownsHall && registered && !hallOwner,
    canComment: authenticated && !hallOwner && (registered || admin),
    canRate: authenticated && !hallOwner && (registered || admin),
    canContactOwner: authenticated && !ownsHall && (registered || hallOwner),
  };
}
