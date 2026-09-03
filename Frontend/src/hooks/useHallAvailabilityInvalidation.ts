"use client";

import { useEffect } from "react";
import { BOOKING_CANCELLED_EVENT, type BookingCancelledDetail } from "@/lib/booking-events";

export function useHallAvailabilityInvalidation(hallId: string, onInvalidate: () => void) {
  useEffect(() => {
    const onCancelled = (event: Event) => {
      const detail = (event as CustomEvent<BookingCancelledDetail>).detail;
      if (!detail?.hallId || detail.hallId !== hallId) return;
      onInvalidate();
    };

    window.addEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
    return () => window.removeEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
  }, [hallId, onInvalidate]);
}
