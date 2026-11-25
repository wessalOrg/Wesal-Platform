"use client";

import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import {
  hallAccessFromHall,
  UNLOCKED_HALL_ACCESS,
  UNKNOWN_HALL_ACCESS,
  type HallAccessState,
} from "@/lib/hall-access";

/**
 * Owner-side flags retain unknown values. The neutral non-owner/no-hall branch
 * also supports professional CustomerProvider conversations.
 */
export function useOwnedHallAccess(hallId: string | null): {
  access: HallAccessState;
  flagsReady: boolean;
} {
  const { ready, isHallOwner } = useAccountAccess();
  const { halls, status } = useHallOwnerHalls();
  const id = hallId?.trim() || "";

  if (!ready) {
    return { access: UNKNOWN_HALL_ACCESS, flagsReady: false };
  }

  if (!isHallOwner || !id) {
    return { access: UNLOCKED_HALL_ACCESS, flagsReady: true };
  }

  const hall = halls.find((item) => item.id === id);
  const flagsReady = status === "ready" || status === "error";

  if (!hall) {
    return { access: UNKNOWN_HALL_ACCESS, flagsReady };
  }

  return {
    access: hallAccessFromHall(hall),
    flagsReady,
  };
}
