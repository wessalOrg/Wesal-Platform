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

/** i18n key for the workspace topbar title (لوحة …). */
export function professionalAppTitleKey(
  role: WesalRole | null | undefined,
): string {
  if (isPhotographerRole(role)) return "pro.dash.appTitle.photographer";
  if (isEventCoordinatorRole(role)) return "pro.dash.appTitle.coordinator";
  return "seeker.appTitle";
}
