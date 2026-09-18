"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ADMIN_MANAGEMENT_PATH, REGULAR_PROFILE_PATH } from "@/lib/account-profile-path";
import { useAccountAccess } from "@/hooks/useAccountAccess";

const LANDING_PATH = "/";

export default function HallOwnerManagementGuard({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { ready, authenticated, isHallOwner, isAdmin } = useAccountAccess();

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      router.replace(LANDING_PATH);
      return;
    }
    if (isAdmin) {
      router.replace(ADMIN_MANAGEMENT_PATH);
      return;
    }
    if (!isHallOwner) {
      router.replace(REGULAR_PROFILE_PATH);
    }
  }, [ready, authenticated, isHallOwner, isAdmin, router]);

  if (!ready || !authenticated || !isHallOwner) {
    return (
      <div
        className="seeker-app-guard h-72 animate-pulse rounded-2xl bg-white/80"
        aria-busy="true"
        data-testid={
          !ready
            ? "owner-management-loading"
            : !authenticated
              ? "owner-management-redirect-landing"
              : "owner-management-redirect"
        }
      />
    );
  }

  return children;
}
