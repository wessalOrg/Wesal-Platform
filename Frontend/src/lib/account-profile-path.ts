import {
  isAdminRole,
  isEventCoordinatorRole,
  isHallOwnerRole,
  isPhotographerRole,
} from "@/lib/account-role";
import { resolveAuthRedirect } from "@/lib/auth-storage";
import type { WesalRole } from "@/types/session";

/** Event Coordinator role-specific setup (after standard registration). */
export const COORDINATOR_SETUP_PATH = "/register/coordinator-setup";

/**
 * Photographer role-specific setup route.
 * Full Photographer Setup UI is Task 3 — this path must exist so registration
 * never silently redirects photographers to coordinator setup or a generic success page.
 */
export const PHOTOGRAPHER_SETUP_PATH = "/register/photographer-setup";

/** Regular User profile portal. */
export const REGULAR_PROFILE_PATH = "/profile";

/** Regular User messages. */
export const REGULAR_MESSAGES_PATH = `${REGULAR_PROFILE_PATH}/messages`;

/** Hall Owner dashboard workspace (home + management). */
export const HALL_OWNER_MANAGEMENT_PATH = "/owner";

/** Hall Owner account / profile section. */
export const HALL_OWNER_PROFILE_PATH = "/owner/profile";

/** Hall Owner halls list. */
export const HALL_OWNER_HALLS_PATH = "/owner/halls";

/** Hall Owner messages. */
export const HALL_OWNER_MESSAGES_PATH = "/owner/messages";

/** Hall Owner notifications feed (all account alerts). */
export const HALL_OWNER_NOTIFICATIONS_PATH = "/owner/notifications";

/** Hall Owner offers management. */
export const HALL_OWNER_OFFERS_PATH = "/owner/offers";

/** Professional (coordinator / photographer) offers management. */
export const PROFESSIONAL_OFFERS_MANAGE_PATH = "/profile/offers";

/** Public Discover feed (includes Offers filter). */
export const DISCOVER_PATH = "/discover";

/** Public professional (coordinator / photographer) profile. */
export const PROFESSIONAL_PUBLIC_PATH = "/professionals";

/** Standalone Hall Owner bookings calendar (Edit 25). Distinct from /owner/bookings, which aliases booking requests. */
export const HALL_OWNER_CALENDAR_PATH = "/owner/calendar";

/**
 * Add Hall form route (US-OWNER-04 destination).
 * US-OWNER-03 only navigates here after successful initiation.
 */
export const HALL_OWNER_ADD_HALL_PATH = "/owner/halls/add";

/** Admin panel workspace (hall submissions). */
export const ADMIN_MANAGEMENT_PATH = "/admin";

/** Admin account / profile photo settings. */
export const ADMIN_ACCOUNT_PATH = "/admin/account";

/** Private Mabrouk Knowledge Studio workspace. */
export const ADMIN_MABROUK_PATH = "/admin/mabrouk";

/** Admin rejected-halls queue (Edit 26). Kept off `/admin/halls` so it does not share the pending-submissions active state. */
export const ADMIN_REJECTED_HALLS_PATH = "/admin/rejected-halls";

/** Admin subscription overview. */
export const ADMIN_SUBSCRIPTIONS_PATH = "/admin/subscriptions";

/** Admin unified messaging (conversations + payment notices). */
export const ADMIN_MESSAGES_PATH = "/admin/messages";

/** Admin Help Center queue (questions submitted from `/help`). */
export const ADMIN_HELP_QUESTIONS_PATH = "/admin/help-questions";

/** Admin Event Coordinator registration requests (Task 6). */
export const ADMIN_COORDINATORS_PATH = "/admin/coordinators";

/** Admin Photographer registration requests (Task 7). */
export const ADMIN_PHOTOGRAPHERS_PATH = "/admin/photographers";

/** Public professional profile (Task 8) — coordinator or photographer by userId. */
export const PROFESSIONALS_PATH = "/professionals";

export function professionalProfilePath(userId: string): string {
  return `${PROFESSIONALS_PATH}/${encodeURIComponent(userId.trim())}`;
}

/** Admin post / offer moderation (Section 15). */
export const ADMIN_POSTS_PATH = "/admin/posts";

export function adminHallSubmissionPath(hallId: string): string {
  return `${ADMIN_MANAGEMENT_PATH}/halls/${encodeURIComponent(hallId)}`;
}

export function adminCoordinatorRequestPath(userId: string): string {
  return `${ADMIN_COORDINATORS_PATH}/${encodeURIComponent(userId)}`;
}

export function adminPhotographerRequestPath(userId: string): string {
  return `${ADMIN_PHOTOGRAPHERS_PATH}/${encodeURIComponent(userId)}`;
}

/** Deep-link Admin messages to a resolved Admin↔account conversation. */
export function adminAccountMessagesPath(
  conversationId: string,
  displayName?: string | null,
): string {
  const params = new URLSearchParams();
  params.set("conversation_id", conversationId.trim());
  const name = displayName?.trim();
  if (name) params.set("peer", name);
  return `${ADMIN_MESSAGES_PATH}?${params.toString()}`;
}

/** Deep-link Admin messages to a resolved Admin↔coordinator conversation. */
export function adminCoordinatorMessagesPath(
  conversationId: string,
  displayName?: string | null,
): string {
  return adminAccountMessagesPath(conversationId, displayName);
}

/** Deep-link Admin messages to a resolved Admin↔photographer conversation. */
export function adminPhotographerMessagesPath(
  conversationId: string,
  displayName?: string | null,
): string {
  return adminAccountMessagesPath(conversationId, displayName);
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

/** Role-aware Messages destination — same pages the dashboards use. */
export function getAccountMessagesPath(
  role: WesalRole | null | undefined,
): string {
  if (isAdminRole(role)) return ADMIN_MESSAGES_PATH;
  return isHallOwnerRole(role) ? HALL_OWNER_MESSAGES_PATH : REGULAR_MESSAGES_PATH;
}

export function isAccountMessagesActive(
  pathname: string,
  role: WesalRole | null | undefined,
): boolean {
  const href = getAccountMessagesPath(role);
  return pathname === href || pathname.startsWith(`${href}/`);
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
    if (requested.startsWith(HALL_OWNER_MANAGEMENT_PATH)) return requested;
    if (requested.startsWith("/halls/")) return requested;
    return HALL_OWNER_MANAGEMENT_PATH;
  }
  // Professionals land on /profile; that page routes incomplete setup → setup
  // and shows the pending-approval shell when review is still open.
  if (isEventCoordinatorRole(role) || isPhotographerRole(role)) {
    const requested = resolveAuthRedirect(redirectParam, actionParam);
    if (requested.startsWith("/halls/")) return requested;
    if (requested.startsWith(REGULAR_PROFILE_PATH)) return requested;
    return REGULAR_PROFILE_PATH;
  }
  return resolveAuthRedirect(redirectParam, actionParam);
}

/** Post-register destination for roles that require setup before they are complete. */
export function resolveRoleSetupPath(
  accountTypeOrRole: string | null | undefined,
): string | null {
  const value = (accountTypeOrRole ?? "").trim().toLowerCase();
  if (value === "eventcoordinator" || value === "coordinator") {
    return COORDINATOR_SETUP_PATH;
  }
  if (value === "photographer") {
    return PHOTOGRAPHER_SETUP_PATH;
  }
  return null;
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
