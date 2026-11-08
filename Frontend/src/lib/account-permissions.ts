import {
  isPendingProfessionalReview,
  isProfessionalPublisherRole,
  resolveProfessionalAccountPhase,
} from "@/lib/account-approval";
import type { ProfessionalAccountPhase } from "@/types/account-approval";
import type { WesalRole } from "@/types/session";

export type AccountPermission =
  | "BrowsePublicContent"
  | "BookHall"
  | "MessageAdmin"
  | "CreatePost"
  | "EditPost"
  | "CreateOffer"
  | "EditOffer"
  | "ManageProfessionalContent"
  /** Open setup form in resubmit mode and call setup/resubmit. */
  | "ResubmitSetup";

export type AccountPermissionContext = {
  authenticated: boolean;
  role: WesalRole | null | undefined;
  /** When true, approval/setup are still loading — fail closed for publish. */
  statusLoading?: boolean;
  isSetupComplete?: boolean | null;
  approvalStatus?: string | number | null;
};

function phaseOf(ctx: AccountPermissionContext): ProfessionalAccountPhase {
  return resolveProfessionalAccountPhase(ctx);
}

/**
 * Central policy for Task 4 / Task 5 professional account UI.
 * Fail-closed for restricted publish actions when approval is unknown/loading.
 *
 * Hall booking mirrors backend `HallBookingAccess`: RegisteredUser, EventCoordinator,
 * and Photographer may book regardless of approval status. Approval gates publishing only.
 */
export function canPerformAccountAction(
  permission: AccountPermission,
  ctx: AccountPermissionContext,
): boolean {
  switch (permission) {
    case "BrowsePublicContent":
      return true;

    case "BookHall": {
      if (!ctx.authenticated) return false;
      const role = (ctx.role ?? "").trim().toLowerCase();
      if (role === "hallowner" || role === "owner" || role === "admin") return false;
      return (
        role === "registereduser" ||
        role === "regularuser" ||
        role === "eventcoordinator" ||
        role === "photographer"
      );
    }

    case "MessageAdmin": {
      if (!ctx.authenticated) return false;
      if (isProfessionalPublisherRole(ctx.role)) {
        const phase = phaseOf(ctx);
        // Allowed while pending / needs changes / rejected / approved.
        // Block only guests and needs_setup (complete setup first).
        return phase !== "needs_setup" && phase !== "guest";
      }
      const role = (ctx.role ?? "").trim().toLowerCase();
      return role === "hallowner" || role === "owner";
    }

    case "CreatePost":
    case "EditPost":
    case "CreateOffer":
    case "EditOffer":
    case "ManageProfessionalContent": {
      if (!ctx.authenticated) return false;
      if (!isProfessionalPublisherRole(ctx.role)) return false;
      return phaseOf(ctx) === "approved";
    }

    case "ResubmitSetup": {
      if (!ctx.authenticated) return false;
      if (!isProfessionalPublisherRole(ctx.role)) return false;
      const phase = phaseOf(ctx);
      // Backend: coordinator resubmit = Rejected only; photographer = Rejected | NeedsChanges.
      if (phase === "rejected") return true;
      if (phase === "needs_changes") {
        const role = (ctx.role ?? "").trim().toLowerCase();
        return role === "photographer";
      }
      return false;
    }

    default:
      return false;
  }
}

export function canPublishProfessionalContent(
  ctx: AccountPermissionContext,
): boolean {
  return canPerformAccountAction("ManageProfessionalContent", ctx);
}

export function shouldShowPendingProfessionalProfile(
  ctx: AccountPermissionContext,
): boolean {
  if (!isProfessionalPublisherRole(ctx.role)) return false;
  const phase = phaseOf(ctx);
  return (
    phase === "pending_review" ||
    phase === "needs_changes" ||
    phase === "rejected" ||
    phase === "unknown"
  );
}

export function shouldRedirectProfessionalToSetup(
  ctx: AccountPermissionContext,
): boolean {
  return phaseOf(ctx) === "needs_setup";
}

export function canResubmitProfessionalSetup(
  ctx: AccountPermissionContext,
): boolean {
  return canPerformAccountAction("ResubmitSetup", ctx);
}

export {
  isPendingProfessionalReview,
  isProfessionalPublisherRole,
  resolveProfessionalAccountPhase,
};
