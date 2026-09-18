import {
  HALL_OWNER_ADD_HALL_PATH,
  HALL_OWNER_HALLS_PATH,
  HALL_OWNER_MANAGEMENT_PATH,
  HALL_OWNER_PROFILE_PATH,
} from "@/lib/account-profile-path";

export const OWNER_DASHBOARD_PATH = HALL_OWNER_MANAGEMENT_PATH;
export const OWNER_ACCOUNT_PATH = HALL_OWNER_PROFILE_PATH;
export const OWNER_HALLS_PATH = HALL_OWNER_HALLS_PATH;

/**
 * Primary Hall Owner dashboard sidebar links (seeker-style shell).
 * Profile remains the account page (US-OWNER-01).
 */
export const HALL_OWNER_DASHBOARD_NAV = [
  {
    id: "home",
    href: OWNER_DASHBOARD_PATH,
    labelKey: "owner.nav.home",
    match: "exact" as const,
  },
  {
    id: "account",
    href: OWNER_ACCOUNT_PATH,
    labelKey: "owner.nav.account",
    match: "prefix" as const,
  },
  {
    id: "halls",
    href: OWNER_HALLS_PATH,
    labelKey: "owner.nav.halls",
    match: "prefix" as const,
  },
] as const;

/**
 * @deprecated Prefer HALL_OWNER_DASHBOARD_NAV — kept for older imports.
 */
export const HALL_OWNER_MANAGEMENT_NAV = [
  {
    id: "profile",
    href: HALL_OWNER_PROFILE_PATH,
    labelKey: "owner.management.nav.profile",
  },
] as const;

/**
 * Sidebar actions that require backend orchestration (not plain links).
 * Add Hall starts US-OWNER-03 initiation before any navigation.
 */
export const HALL_OWNER_MANAGEMENT_ACTIONS = [
  {
    id: "add-hall",
    labelKey: "owner.management.nav.addHall",
    destinationHref: HALL_OWNER_ADD_HALL_PATH,
  },
] as const;

export type HallOwnerDashboardNavId =
  (typeof HALL_OWNER_DASHBOARD_NAV)[number]["id"];

export type HallOwnerManagementSectionId =
  (typeof HALL_OWNER_MANAGEMENT_NAV)[number]["id"];

export type HallOwnerManagementActionId =
  (typeof HALL_OWNER_MANAGEMENT_ACTIONS)[number]["id"];

export const DEFAULT_HALL_OWNER_MANAGEMENT_SECTION =
  HALL_OWNER_MANAGEMENT_NAV[0];

export function isOwnerNavActive(
  pathname: string,
  href: string,
  match: "exact" | "prefix",
): boolean {
  if (match === "exact") {
    return pathname === href;
  }
  // Avoid marking "halls" active on unrelated owner routes; still cover
  // /owner/halls, /owner/halls/[id], and /owner/halls/add.
  return pathname === href || pathname.startsWith(`${href}/`);
}
