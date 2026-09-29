import { HALL_OWNER_MESSAGES_PATH, REGULAR_PROFILE_PATH } from "@/lib/account-profile-path";
import { isHallOwnerRole } from "@/lib/account-role";
import type { WesalRole } from "@/types/session";

export const SEEKER_DASHBOARD_PATH = REGULAR_PROFILE_PATH;
export const SEEKER_ACCOUNT_PATH = `${REGULAR_PROFILE_PATH}/account`;
export const SEEKER_BOOKINGS_PATH = `${REGULAR_PROFILE_PATH}/bookings`;

export function seekerBookingContactPath(bookingId: string): string {
  const id = bookingId.trim();
  return id
    ? `${SEEKER_BOOKINGS_PATH}?booking_id=${encodeURIComponent(id)}&intent=contact`
    : SEEKER_BOOKINGS_PATH;
}
export const SEEKER_NOTIFICATIONS_PATH = `${REGULAR_PROFILE_PATH}/notifications`;
export const SEEKER_MESSAGES_PATH = `${REGULAR_PROFILE_PATH}/messages`;

/** Messages page URL for a hall thread (seeker or owner-as-booker). */
export function conversationMessagesPath(
  role: WesalRole | null | undefined,
  options: { conversationId?: string | null; hallId?: string | null } = {},
): string {
  const params = new URLSearchParams();
  if (options.hallId?.trim()) params.set("hallId", options.hallId.trim());
  if (options.conversationId?.trim()) {
    params.set("conversation_id", options.conversationId.trim());
  }
  const base = isHallOwnerRole(role) ? HALL_OWNER_MESSAGES_PATH : SEEKER_MESSAGES_PATH;
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** @deprecated Merged into account — kept as alias for old links. */
export const SEEKER_SETTINGS_PATH = SEEKER_ACCOUNT_PATH;

/**
 * Hall seeker dashboard sidebar (Epic 6 portal shell).
 * Profile + settings are one account page; favorites removed.
 */
export const SEEKER_DASHBOARD_NAV = [
  {
    id: "home",
    href: SEEKER_DASHBOARD_PATH,
    labelKey: "seeker.nav.home",
    match: "exact" as const,
  },
  {
    id: "account",
    href: SEEKER_ACCOUNT_PATH,
    labelKey: "seeker.nav.account",
    match: "prefix" as const,
  },
  {
    id: "bookings",
    href: SEEKER_BOOKINGS_PATH,
    labelKey: "seeker.nav.bookings",
    match: "prefix" as const,
  },
  {
    id: "messages",
    href: SEEKER_MESSAGES_PATH,
    labelKey: "seeker.nav.messages",
    match: "prefix" as const,
  },
  {
    id: "notifications",
    href: SEEKER_NOTIFICATIONS_PATH,
    labelKey: "seeker.nav.notifications",
    match: "prefix" as const,
  },
] as const;

export type SeekerDashboardNavId =
  (typeof SEEKER_DASHBOARD_NAV)[number]["id"];

export function isSeekerNavActive(
  pathname: string,
  href: string,
  match: "exact" | "prefix",
): boolean {
  if (match === "exact") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
