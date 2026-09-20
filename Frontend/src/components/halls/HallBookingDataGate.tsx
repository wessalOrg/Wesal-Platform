"use client";

import type { ReactNode } from "react";
import HallLockedState from "@/components/halls/HallLockedState";
import ManagementAccessBlockedState from "@/components/halls/ManagementAccessBlockedState";
import {
  getManagementAccess,
  type HallAccessState,
  type ManagementAccessReason,
} from "@/lib/hall-access";

type HallBookingDataGateProps = {
  access: HallAccessState;
  flagsReady: boolean;
  forbiddenFromApi?: boolean;
  apiDenial?: ManagementAccessReason | null;
  children: ReactNode;
};

export default function HallBookingDataGate({
  access,
  flagsReady,
  forbiddenFromApi = false,
  apiDenial = null,
  children,
}: HallBookingDataGateProps) {
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
  if (!result.allowed) {
    return <ManagementAccessBlockedState reason={result.reason} />;
  }
  if (apiDenial) {
    return <ManagementAccessBlockedState reason={apiDenial} />;
  }
  if (forbiddenFromApi) {
    return <HallLockedState reason="both" />;
  }

  return children;
}
