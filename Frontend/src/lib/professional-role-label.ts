import {
  isEventCoordinatorRole,
  isPhotographerRole,
} from "@/lib/account-role";
import type { WesalRole } from "@/types/session";

/** i18n key for the workspace role chip (sidebar / topbar / dashboard). */
export function professionalRoleLabelKey(
  role: WesalRole | null | undefined,
): string {
  if (isPhotographerRole(role)) return "auth.pendingAccount.rolePhotographer";
  if (isEventCoordinatorRole(role)) return "auth.pendingAccount.roleCoordinator";
  return "seeker.role";
}
