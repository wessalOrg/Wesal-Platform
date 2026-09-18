import type { WesalRole } from "@/types/session";

export function normalizeRole(role: WesalRole | null | undefined): string {
  return (role ?? "").trim().toLowerCase();
}

export function isHallOwnerRole(role: WesalRole | null | undefined): boolean {
  const normalized = normalizeRole(role);
  return normalized === "hallowner" || normalized === "owner";
}

export function isAdminRole(role: WesalRole | null | undefined): boolean {
  return normalizeRole(role) === "admin";
}

export function isHallOwnerAccountType(
  accountType: string | null | undefined,
): boolean {
  return isHallOwnerRole(accountType);
}

export function asWesalRole(
  value: WesalRole | string | null | undefined,
): WesalRole | null {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

/**
 * Login/register may send Role or only AccountType. Prefer an explicit role,
 * then treat HallOwner account type as the owner role.
 */
export function roleFromAccountSignals(
  role?: string | null,
  accountType?: string | null,
): WesalRole | null {
  return (
    asWesalRole(role) ??
    (isHallOwnerAccountType(accountType) ? "HallOwner" : asWesalRole(accountType))
  );
}

/**
 * Session API wins when it actually sends a role. Empty /session roles fall
 * back to the stored login role or account type so owners are not shown the
 * seeker dashboard.
 */
export function resolveSessionRole(
  sessionRole?: WesalRole | null,
  storedRole?: string | null,
  accountType?: string | null,
): WesalRole | null {
  return (
    asWesalRole(sessionRole) ?? roleFromAccountSignals(storedRole, accountType)
  );
}

/**
 * Regular-user profile is for authenticated accounts that are not Hall Owners
 * or Admins. Stub login has no session role yet, so a missing role still qualifies.
 */
export function canAccessRegularProfile(
  authenticated: boolean,
  role: WesalRole | null | undefined,
): boolean {
  return authenticated && !isHallOwnerRole(role) && !isAdminRole(role);
}
