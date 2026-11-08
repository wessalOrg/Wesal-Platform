"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProfessionalDashboardHome from "@/components/professionals/ProfessionalDashboardHome";
import SeekerDashboardHome from "@/components/seeker-dashboard/SeekerDashboardHome.lazy";
import { useProfessionalAccountAccess } from "@/hooks/useProfessionalAccountAccess";
import {
  COORDINATOR_SETUP_PATH,
  PHOTOGRAPHER_SETUP_PATH,
} from "@/lib/account-profile-path";
import { isEventCoordinatorRole } from "@/lib/account-role";
import { markAuthNavigation } from "@/lib/auth-nav";

/** Seeker home — professionals get a role/status dashboard instead. */
export default function ProfilePageView() {
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

    return <ProfessionalDashboardHome />;
  }

  return <SeekerDashboardHome />;
}
