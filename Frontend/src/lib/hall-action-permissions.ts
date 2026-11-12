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
  const value = normalizeRole(role);
  return value === "hallowner" || value === "owner";
}

/**
 * Mirrors backend `HallBookingAccess.IsSeeker`: RegisteredUser, EventCoordinator,
 * and Photographer may browse/book/comment/rate. Hall owners and admins cannot.
 * Account approval is intentionally ignored — it gates publishing only.
 */
function isHallSeekerRole(role: string | null | undefined): boolean {
  if (isHallOwnerRole(role)) return false;
  const value = normalizeRole(role);
  return (
    value === "registereduser" ||
    value === "regularuser" ||
    value === "eventcoordinator" ||
    value === "photographer"
  );
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
  const canActAsSeeker = isHallSeekerRole(session.role);

  return {
    authReady,
    isGuest,
    isOwnHall: ownsHall,
    canBook: authenticated && !ownsHall && canActAsSeeker,
    canComment: authenticated && !ownsHall && canActAsSeeker,
    canRate: authenticated && !ownsHall && canActAsSeeker,
    canContactOwner: authenticated && !ownsHall && canActAsSeeker,
  };
}
