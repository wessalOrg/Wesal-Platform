"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { emitBookingPublished } from "@/lib/booking-events";
import { notifyPublicHallsChanged } from "@/lib/public-halls-events";
import { PublishBookingError } from "@/lib/publish-booking-errors";
import { publishHallBooking } from "@/services/hall-notifications";
import type { OwnerBookingRequestStatus, PublishBookingResult } from "@/types/hall-notifications";

type UsePublishBookingOptions = {
  onPublished?: (result: PublishBookingResult) => void;
  onStatusSync?: (bookingId: string, status: OwnerBookingRequestStatus) => void;
};

export function usePublishBooking(options?: UsePublishBookingOptions) {
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const inFlightRef = useRef<string | null>(null);
  const onPublishedRef = useRef(options?.onPublished);
  const onStatusSyncRef = useRef(options?.onStatusSync);
  useEffect(() => {
    onPublishedRef.current = options?.onPublished;
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

  const publish = useCallback(
    async (hallId: string, bookingId: string) => {
      const id = bookingId.trim();
      if (!id || inFlightRef.current) return null;

      inFlightRef.current = id;
      setPublishingId(id);
      clearError(id);

      try {
        const result = await publishHallBooking(hallId, id);
        onPublishedRef.current?.(result);
        emitBookingPublished({
          bookingId: result.bookingId,
          hallId: result.hallId,
          date: result.date,
          periods: result.periods,
        });
        notifyPublicHallsChanged();
        return result;
      } catch (err) {
        const mapped =
          err instanceof PublishBookingError
            ? err
            : new PublishBookingError("errors.owner.publish.generic");
        setErrorById((current) => ({
          ...current,
          [id]: mapped.backendMessage || mapped.message,
        }));
        if (mapped.resolvedStatus) {
          onStatusSyncRef.current?.(id, mapped.resolvedStatus);
        }
        return null;
      } finally {
        inFlightRef.current = null;
        setPublishingId(null);
      }
    },
    [clearError],
  );

  return {
    publish,
    publishingId,
    errorById,
    clearError,
  };
}
