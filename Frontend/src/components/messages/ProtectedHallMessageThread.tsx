"use client";

import type { ReactNode } from "react";
import ManagementAccessBlockedState from "@/components/halls/ManagementAccessBlockedState";
import { useOwnedHallAccess } from "@/hooks/useOwnedHallAccess";
import { getManagementAccess } from "@/lib/hall-access";

type ProtectedHallMessageThreadProps = {
  hallId: string | null | undefined;
  children: ReactNode;
};

/** Admin/system locks still block. Payment-pending halls stay open so the owner can talk to Admin. */
export default function ProtectedHallMessageThread({
  hallId,
  children,
}: ProtectedHallMessageThreadProps) {
  const { access, flagsReady } = useOwnedHallAccess(hallId ?? null);

  if (!flagsReady) {
    return (
      <div
        className="h-40 animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]"
        aria-busy="true"
        data-testid="owner-hall-access-loading"
      />
    );
  }

  const result = getManagementAccess(access);
  if (!result.allowed && result.reason !== "PAYMENT_REQUIRED") {
    return <ManagementAccessBlockedState reason={result.reason} />;
  }

  return children;
}
