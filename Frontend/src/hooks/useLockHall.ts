"use client";

import { useCallback, useRef, useState } from "react";
import { toLockHallError } from "@/lib/admin-lock-hall-errors";
import { notifyHallOwnerHallsChanged } from "@/lib/hall-owner-halls-events";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import { lockAdminHall } from "@/services/admin-halls";
import type { AdminHallLockResult } from "@/types/admin-halls";

type UseLockHallOptions = {
  onLocked?: (result: AdminHallLockResult) => void;
};

export function useLockHall(options?: UseLockHallOptions) {
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const onLockedRef = useRef(options?.onLocked);
  onLockedRef.current = options?.onLocked;

  const clearError = useCallback(() => {
    setErrorKey(null);
  }, []);

  const lock = useCallback(async (hallId: string) => {
    const id = hallId.trim();
    if (!id || inFlightRef.current) return null;

    inFlightRef.current = true;
    setPending(true);
    setErrorKey(null);

    try {
      const result = await lockAdminHall(id);
      notifyPublicHallsChanged();
      notifyHallOwnerHallsChanged();
      onLockedRef.current?.(result);
      return result;
    } catch (err) {
      const mapped = toLockHallError(err);
      setErrorKey(mapped.message);
      return null;
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }, []);

  return {
    lock,
    pending,
    errorKey,
    clearError,
  };
}
