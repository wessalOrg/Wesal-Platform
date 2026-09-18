"use client";

import { useCallback, useRef, useState } from "react";
import { toUnlockHallError } from "@/lib/admin-unlock-hall-errors";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import { unlockAdminHall } from "@/services/admin-halls";
import type { AdminHallUnlockResult } from "@/types/admin-halls";

type UseUnlockHallOptions = {
  onUnlocked?: (result: AdminHallUnlockResult) => void;
};

export function useUnlockHall(options?: UseUnlockHallOptions) {
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const onUnlockedRef = useRef(options?.onUnlocked);
  onUnlockedRef.current = options?.onUnlocked;

  const clearError = useCallback(() => {
    setErrorKey(null);
  }, []);

  const unlock = useCallback(async (hallId: string) => {
    const id = hallId.trim();
    if (!id || inFlightRef.current) return null;

    inFlightRef.current = true;
    setPending(true);
    setErrorKey(null);

    try {
      const result = await unlockAdminHall(id);
      if (!result.adminLocked && !result.systemLocked) {
        notifyPublicHallsChanged();
      }
      onUnlockedRef.current?.(result);
      return result;
    } catch (err) {
      const mapped = toUnlockHallError(err);
      setErrorKey(mapped.message);
      return null;
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }, []);

  return {
    unlock,
    pending,
    errorKey,
    clearError,
  };
}
