"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAccountAccess } from "@/hooks/useAccountAccess";

const LANDING_PATH = "/";

export default function AdminManagementGuard({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const { ready, authenticated, isAdmin } = useAccountAccess();

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      router.replace(LANDING_PATH);
      return;
    }
    if (!isAdmin) {
      router.replace(LANDING_PATH);
    }
  }, [ready, authenticated, isAdmin, router]);

  if (!ready || !authenticated || !isAdmin) {
    return (
      <div
        className="seeker-app-guard h-72 animate-pulse rounded-2xl bg-white/80"
        aria-busy="true"
        data-testid={
          !ready
            ? "admin-management-loading"
            : !authenticated
              ? "admin-management-redirect-landing"
              : "admin-management-redirect"
        }
      />
    );
  }

  return children;
}
