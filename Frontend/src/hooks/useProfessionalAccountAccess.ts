"use client";

import { useMemo } from "react";
import { useOptionalUserProfileStore } from "@/components/profile/UserProfileProvider";
import { useAccountAccess } from "@/hooks/useAccountAccess";
import {
  canPerformAccountAction,
  canPublishProfessionalContent,
  canResubmitProfessionalSetup,
  isProfessionalPublisherRole,
  shouldRedirectProfessionalToSetup,
  shouldShowPendingProfessionalProfile,
  type AccountPermissionContext,
} from "@/lib/account-permissions";
import { resolveProfessionalAccountPhase } from "@/lib/account-approval";

/**
 * Approval-aware access for EventCoordinator / Photographer (Task 4).
 * Profile fields are the source of truth; loading/unknown fail closed for publish.
 */
export function useProfessionalAccountAccess() {
  const account = useAccountAccess();
  const store = useOptionalUserProfileStore();
  const profile = account.canOpenRegularProfile ? store?.profile ?? null : null;
  const profileStatus = store?.status ?? "idle";

  const statusLoading =
    isProfessionalPublisherRole(account.role) &&
    (profileStatus === "loading" ||
      profileStatus === "idle" ||
      (profileStatus === "ready" && profile === null));

  const ctx: AccountPermissionContext = useMemo(
    () => ({
      authenticated: account.authenticated,
      role: account.role,
      statusLoading,
      isSetupComplete: profile?.isSetupComplete ?? null,
      approvalStatus: profile?.approvalStatus ?? null,
    }),
    [
      account.authenticated,
      account.role,
      profile?.approvalStatus,
      profile?.isSetupComplete,
      statusLoading,
    ],
  );

  const phase = resolveProfessionalAccountPhase(ctx);

  return {
    ...account,
    profile,
    profileStatus,
    statusLoading,
    phase,
    permissionContext: ctx,
    canPublish: canPublishProfessionalContent(ctx),
    canMessageAdmin: canPerformAccountAction("MessageAdmin", ctx),
    canResubmitSetup: canResubmitProfessionalSetup(ctx),
    showPendingProfile: shouldShowPendingProfessionalProfile(ctx),
    redirectToSetup: shouldRedirectProfessionalToSetup(ctx),
    isProfessional: isProfessionalPublisherRole(account.role),
  };
}
