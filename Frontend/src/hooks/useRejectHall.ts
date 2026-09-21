"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toRejectHallError } from "@/lib/admin-reject-hall-errors";
import { notifyHallOwnerHallsChanged } from "@/lib/hall-owner-halls-events";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import { rejectAdminHall } from "@/services/admin-halls";
import type { AdminHallRejectResult, AdminRejectHallRequest } from "@/types/admin-halls";

type UseRejectHallOptions = {
  onRejected?: (result: AdminHallRejectResult) => void;
  onNeedsLiveConfirm?: () => void;
};

export function useRejectHall(options?: UseRejectHallOptions) {
  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const inFlightRef = useRef(false);
  const onRejectedRef = useRef(options?.onRejected);
  const onNeedsLiveConfirmRef = useRef(options?.onNeedsLiveConfirm);
  useEffect(() => {
    onRejectedRef.current = options?.onRejected;
    onNeedsLiveConfirmRef.current = options?.onNeedsLiveConfirm;
  });

  const clearError = useCallback(() => {
    setErrorKey(null);
  }, []);

  const reject = useCallback(async (hallId: string, request: AdminRejectHallRequest = {}) => {
    const id = hallId.trim();
    if (!id || inFlightRef.current) return null;

    inFlightRef.current = true;
    setPending(true);
    setErrorKey(null);

    try {
      const result = await rejectAdminHall(id, request);
      notifyPublicHallsChanged();
      notifyHallOwnerHallsChanged();
      onRejectedRef.current?.(result);
      return result;
    } catch (err) {
      const mapped = toRejectHallError(err);
      if (mapped.kind === "conflict" && !request.confirmLiveApproved) {
        onNeedsLiveConfirmRef.current?.();
        return null;
      }
      setErrorKey(mapped.message);
      return null;
    } finally {
      inFlightRef.current = false;
      setPending(false);
    }
  }, []);

  return {
    reject,
    pending,
    errorKey,
    clearError,
  };
}
