"use client";

import { useCallback, useRef, useState } from "react";
import { toMarkPaidError } from "@/lib/admin-mark-paid-errors";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import { markAdminHallSubscriptionPaid } from "@/services/admin-halls";
import type { AdminMarkPaidResult } from "@/types/admin-halls";

type UseMarkHallSubscriptionPaidOptions = {
  onPaid?: (result: AdminMarkPaidResult) => void;
};

export function useMarkHallSubscriptionPaid(options?: UseMarkHallSubscriptionPaidOptions) {
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const onPaidRef = useRef(options?.onPaid);
  onPaidRef.current = options?.onPaid;

  const clearError = useCallback(() => {
    setErrorKey(null);
  }, []);

  const markPaid = useCallback(async (hallId: string) => {
    const id = hallId.trim();
    if (!id || inFlightRef.current) return null;

    inFlightRef.current = true;
    setPending(true);
    setErrorKey(null);

    try {
      const result = await markAdminHallSubscriptionPaid(id);
      if (!result.adminLocked && !result.systemLocked) {
        notifyPublicHallsChanged();
      }
      onPaidRef.current?.(result);
      return result;
    } catch (err) {
      const mapped = toMarkPaidError(err);
      setErrorKey(mapped.message);
      return null;
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }, []);

  return {
    markPaid,
    pending,
    errorKey,
    clearError,
  };
}
