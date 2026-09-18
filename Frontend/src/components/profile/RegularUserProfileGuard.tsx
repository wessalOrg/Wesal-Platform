"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ADMIN_MANAGEMENT_PATH, HALL_OWNER_MANAGEMENT_PATH } from "@/lib/account-profile-path";
import { useUserIdentity } from "@/hooks/useUserIdentity";

const LANDING_PATH = "/";

export default function RegularUserProfileGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { ready, authenticated, isHallOwner, isAdmin } = useUserIdentity();

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

    if (isHallOwner) {
      router.replace(HALL_OWNER_MANAGEMENT_PATH);
    }
  }, [ready, authenticated, isHallOwner, isAdmin, router]);

  if (!ready || !authenticated || isHallOwner || isAdmin) {
    return (
      <div className="seeker-app-guard">
        <div
          className="h-72 max-w-xl animate-pulse rounded-2xl bg-white shadow-[0_12px_30px_rgba(90,55,45,0.08)]"
          aria-busy="true"
          data-testid={
            !ready
              ? "profile-loading"
              : !authenticated
                ? "profile-guest-redirect"
                : "profile-owner-redirect"
          }
        />
      </div>
    );
  }

  return children;
}
