import { isAdminRole, isHallOwnerRole } from "@/lib/account-role";
import { resolveAuthRedirect } from "@/lib/auth-storage";
import type { WesalRole } from "@/types/session";

/** Regular User profile portal. */
export const REGULAR_PROFILE_PATH = "/profile";

/** Hall Owner dashboard workspace (home + management). */
export const HALL_OWNER_MANAGEMENT_PATH = "/owner";

/** Hall Owner account / profile section. */
export const HALL_OWNER_PROFILE_PATH = "/owner/profile";

/** Hall Owner halls list. */
export const HALL_OWNER_HALLS_PATH = "/owner/halls";

/** Hall Owner messages. */
export const HALL_OWNER_MESSAGES_PATH = "/owner/messages";

/**
 * Add Hall form route (US-OWNER-04 destination).
 * US-OWNER-03 only navigates here after successful initiation.
 */
export const HALL_OWNER_ADD_HALL_PATH = "/owner/halls/add";

/** Admin panel workspace (hall submissions). */
export const ADMIN_MANAGEMENT_PATH = "/admin";

/** Admin subscription overview. */
export const ADMIN_SUBSCRIPTIONS_PATH = "/admin/subscriptions";

export function adminHallSubmissionPath(hallId: string): string {
  return `${ADMIN_MANAGEMENT_PATH}/halls/${encodeURIComponent(hallId)}`;
}

/**
 * Role-aware destination for the Profile icon / account Profile link.
 * Admins enter the admin workspace; Hall Owners enter management;
 * everyone else keeps `/profile`.
 */
export function getAccountProfilePath(
  role: WesalRole | null | undefined,
): string {
  if (isAdminRole(role)) return ADMIN_MANAGEMENT_PATH;
  return isHallOwnerRole(role)
    ? HALL_OWNER_MANAGEMENT_PATH
    : REGULAR_PROFILE_PATH;
}

/**
 * After login, Admins enter `/admin` and Hall Owners enter `/owner`.
 * Seeker booking redirects stay on the public hall path.
 */
export function resolveLoginDestination(
  role: WesalRole | null | undefined,
  redirectParam?: string,
  actionParam?: string,
): string {
  if (isAdminRole(role)) {
    const requested = resolveAuthRedirect(redirectParam, actionParam);
    return requested.startsWith(ADMIN_MANAGEMENT_PATH)
      ? requested
      : ADMIN_MANAGEMENT_PATH;
  }
  if (isHallOwnerRole(role)) {
    const requested = resolveAuthRedirect(redirectParam, actionParam);
    return requested.startsWith(HALL_OWNER_MANAGEMENT_PATH)
      ? requested
      : HALL_OWNER_MANAGEMENT_PATH;
  }
  return resolveAuthRedirect(redirectParam, actionParam);
}

export function isHallOwnerManagementPath(pathname: string): boolean {
  return (
    pathname === HALL_OWNER_MANAGEMENT_PATH ||
    pathname.startsWith(`${HALL_OWNER_MANAGEMENT_PATH}/`)
  );
}

export function isAccountProfileActive(
  pathname: string,
  role: WesalRole | null | undefined,
): boolean {
  if (isAdminRole(role)) {
    return (
      pathname === ADMIN_MANAGEMENT_PATH ||
      pathname.startsWith(`${ADMIN_MANAGEMENT_PATH}/`)
    );
  }
  if (isHallOwnerRole(role)) {
    return isHallOwnerManagementPath(pathname);
  }
  return pathname === REGULAR_PROFILE_PATH || pathname.startsWith(`${REGULAR_PROFILE_PATH}/`);
}
