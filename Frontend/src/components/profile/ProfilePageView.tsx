"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import PendingProfessionalAccountPanel from "@/components/auth/pending-account/PendingProfessionalAccountPanel";
import SeekerDashboardHome from "@/components/seeker-dashboard/SeekerDashboardHome.lazy";
import { useProfessionalAccountAccess } from "@/hooks/useProfessionalAccountAccess";
import { useT } from "@/i18n";
import { isEventCoordinatorRole, isPhotographerRole } from "@/lib/account-role";
import {
  COORDINATOR_SETUP_PATH,
  PHOTOGRAPHER_SETUP_PATH,
} from "@/lib/account-profile-path";
import { markAuthNavigation } from "@/lib/auth-nav";

/** Default seeker landing — pending professionals see the approval shell. */
export default function ProfilePageView() {
  const t = useT();
  const router = useRouter();
  const access = useProfessionalAccountAccess();

  useEffect(() => {
    if (!access.ready || !access.authenticated || !access.isProfessional) return;
    if (access.redirectToSetup) {
      markAuthNavigation();
      router.replace(
        isEventCoordinatorRole(access.role)
          ? COORDINATOR_SETUP_PATH
          : PHOTOGRAPHER_SETUP_PATH,
      );
    }
  }, [
    access.authenticated,
    access.isProfessional,
    access.ready,
    access.redirectToSetup,
    access.role,
    router,
  ]);

  if (access.isProfessional) {
    if (access.phase === "loading" || access.redirectToSetup) {
      return (
        <div
          className="mx-auto h-72 max-w-xl animate-pulse rounded-2xl bg-white shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
          aria-busy="true"
          data-testid="pending-professional-loading"
        />
      );
    }

    if (access.showPendingProfile) {
      const roleLabel = isPhotographerRole(access.role)
        ? t("auth.pendingAccount.rolePhotographer")
        : t("auth.pendingAccount.roleCoordinator");
      return (
        <PendingProfessionalAccountPanel
          phase={access.phase}
          roleLabel={roleLabel}
          role={access.role}
          canResubmitSetup={access.canResubmitSetup}
        />
      );
    }
  }

  return <SeekerDashboardHome />;
}
