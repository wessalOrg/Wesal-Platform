"use client";

import { useAccountAccess } from "@/hooks/useAccountAccess";
import { useHallOwnerHalls } from "@/hooks/useHallOwnerHalls";
import {
  hallAccessFromHall,
  UNLOCKED_HALL_ACCESS,
  type HallAccessState,
} from "@/lib/hall-access";

/**
 * Owner-side lock flags for a hall. Seekers and unknown halls stay unlocked
 * so this policy only affects Hall Owner operational screens.
 */
export function useOwnedHallAccess(hallId: string | null): {
  access: HallAccessState;
  flagsReady: boolean;
} {
  const { ready, isHallOwner } = useAccountAccess();
  const { halls, status } = useHallOwnerHalls();
  const id = hallId?.trim() || "";

  if (!ready) {
    return { access: UNLOCKED_HALL_ACCESS, flagsReady: false };
  }

  if (!isHallOwner || !id) {
    return { access: UNLOCKED_HALL_ACCESS, flagsReady: true };
  }

  const hall = halls.find((item) => item.id === id);
  const flagsReady = status === "ready" || status === "error";

  if (!hall) {
    return { access: UNLOCKED_HALL_ACCESS, flagsReady };
  }

  return {
    access: hallAccessFromHall(hall),
    flagsReady,
  };
}
