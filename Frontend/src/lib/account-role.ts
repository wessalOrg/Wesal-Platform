import type { WesalRole } from "@/types/session";

export function normalizeRole(role: WesalRole | null | undefined): string {
  return (role ?? "").trim().toLowerCase();
}

export function isHallOwnerRole(role: WesalRole | null | undefined): boolean {
  return normalizeRole(role) === "hallowner";
}

/**
 * Regular-user profile is for authenticated accounts that are not Hall Owners.
 * Stub login has no session role yet, so a missing role still qualifies.
 */
export function canAccessRegularProfile(
  authenticated: boolean,
  role: WesalRole | null | undefined,
): boolean {
  return authenticated && !isHallOwnerRole(role);
}
