import { HALL_OWNER_HALLS_PATH } from "@/lib/account-profile-path";
import { isHallOwnerRole } from "@/lib/account-role";
import type { WesalRole } from "@/types/session";

/**
 * Register entry that pre-selects Hall Owner via existing `?type=owner`
 * (see `accountTypeFromQueryType` / `resolveInitialAccountType`).
 */
export const ADD_HALL_REGISTER_HREF = "/register?type=owner";

export type AddHallCtaAuthInput = {
  authStatus: "loading" | "ready";
  isAuthenticated: boolean;
  role: WesalRole | null | undefined;
};

/**
 * Smart destination for "أضف قاعتك" / Add-your-hall CTAs.
 *
 * - Auth still loading → `null` (caller must block navigation)
 * - Authenticated Hall Owner → My Halls (`/owner/halls`)
 * - Guest, Seeker, or other roles → Register with Hall Owner pre-selected
 */
export function resolveAddHallCtaHref(input: AddHallCtaAuthInput): string | null {
  if (input.authStatus !== "ready") return null;

  if (input.isAuthenticated && isHallOwnerRole(input.role)) {
    return HALL_OWNER_HALLS_PATH;
  }

  return ADD_HALL_REGISTER_HREF;
}
