"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  getHallActionPermissions,
  type HallActionPermissions,
  type HallOwnershipInput,
} from "@/lib/hall-action-permissions";

export function useHallPermissions(
  hall?: HallOwnershipInput | null,
): HallActionPermissions {
  const { session, status } = useAuth();
  const isOwnHall = Boolean(hall?.isOwner);

  return useMemo(
    () =>
      getHallActionPermissions({
        session,
        authReady: status === "ready",
        isOwnHall,
      }),
    [session, status, isOwnHall],
  );
}
