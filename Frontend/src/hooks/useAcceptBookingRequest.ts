"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AcceptBookingError } from "@/lib/accept-booking-errors";
import { emitBookingAccepted } from "@/lib/booking-events";
import { acceptHallBookingRequest } from "@/services/hall-notifications";
import type { AcceptBookingResult, OwnerBookingRequestStatus } from "@/types/hall-notifications";

type UseAcceptBookingRequestOptions = {
  onAccepted?: (result: AcceptBookingResult) => void;
  onStatusSync?: (bookingId: string, status: OwnerBookingRequestStatus) => void;
};

export function useAcceptBookingRequest(options?: UseAcceptBookingRequestOptions) {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const inFlightRef = useRef<string | null>(null);
  const onAcceptedRef = useRef(options?.onAccepted);
  const onStatusSyncRef = useRef(options?.onStatusSync);
  useEffect(() => {
    onAcceptedRef.current = options?.onAccepted;
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

  const accept = useCallback(
    async (hallId: string, bookingId: string) => {
      const id = bookingId.trim();
      if (!id || inFlightRef.current) return null;

      inFlightRef.current = id;
      setAcceptingId(id);
      clearError(id);

      try {
        const result = await acceptHallBookingRequest(hallId, id);
        onAcceptedRef.current?.(result);
        emitBookingAccepted({
          bookingId: result.bookingId,
          hallId: result.hallId,
          date: result.date,
          periods: result.periods,
        });
        return result;
      } catch (err) {
        const mapped =
          err instanceof AcceptBookingError
            ? err
            : new AcceptBookingError("errors.owner.accept.generic");
        setErrorById((current) => ({ ...current, [id]: mapped.message }));
        if (mapped.resolvedStatus) {
          onStatusSyncRef.current?.(id, mapped.resolvedStatus);
        }
        return null;
      } finally {
        inFlightRef.current = null;
        setAcceptingId(null);
      }
    },
    [clearError],
  );

  return {
    accept,
    acceptingId,
    errorById,
    clearError,
  };
}
