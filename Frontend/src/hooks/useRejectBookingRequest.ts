"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { emitBookingRejected } from "@/lib/booking-events";
import { RejectBookingError } from "@/lib/reject-booking-errors";
import { rejectHallBookingRequest } from "@/services/hall-notifications";
import type { OwnerBookingRequestStatus, RejectBookingResult } from "@/types/hall-notifications";

type UseRejectBookingRequestOptions = {
  onRejected?: (result: RejectBookingResult) => void;
  onStatusSync?: (bookingId: string, status: OwnerBookingRequestStatus) => void;
};

export function useRejectBookingRequest(options?: UseRejectBookingRequestOptions) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const inFlightRef = useRef<string | null>(null);
  const onRejectedRef = useRef(options?.onRejected);
  const onStatusSyncRef = useRef(options?.onStatusSync);
  useEffect(() => {
    onRejectedRef.current = options?.onRejected;
    onStatusSyncRef.current = options?.onStatusSync;
  });

  const clearError = useCallback((bookingId: string) => {
    setErrorById((current) => {
      if (!current[bookingId]) return current;
      const next = { ...current };
      delete next[bookingId];
      return next;
    });
  }, []);

  const reject = useCallback(
    async (hallId: string, bookingId: string, reason: string) => {
      const id = bookingId.trim();
      if (!id || inFlightRef.current) return null;

      inFlightRef.current = id;
      setRejectingId(id);
      clearError(id);

      try {
        const result = await rejectHallBookingRequest(hallId, id, reason);
        onRejectedRef.current?.(result);
        emitBookingRejected({
          bookingId: result.bookingId,
          hallId: result.hallId,
          date: result.date,
          periods: result.periods,
          deferred: result.notificationDeferred,
        });
        return result;
      } catch (err) {
        const mapped =
          err instanceof RejectBookingError
            ? err
            : new RejectBookingError("errors.owner.reject.generic");
        setErrorById((current) => ({ ...current, [id]: mapped.message }));
        if (mapped.resolvedStatus) {
          onStatusSyncRef.current?.(id, mapped.resolvedStatus);
        }
        return null;
      } finally {
        inFlightRef.current = null;
        setRejectingId(null);
      }
    },
    [clearError],
  );

  return {
    reject,
    rejectingId,
    errorById,
    clearError,
  };
}
