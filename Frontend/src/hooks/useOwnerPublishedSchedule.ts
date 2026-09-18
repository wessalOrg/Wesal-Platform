"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  BOOKING_PUBLISHED_EVENT,
  type BookingPublishedDetail,
} from "@/lib/booking-events";
import {
  getEmptyOwnerPublishedSlots,
  getOwnerPublishedSlots,
  mergeOwnerPublishedSlots,
  subscribeOwnerPublishedSlots,
} from "@/lib/owner-published-slot-store";

/**
 * Reads booked/published schedule overlay. Does not decide availability on the client.
 */
export function useOwnerPublishedSchedule(hallId: string, enabled: boolean) {
  const scoped = enabled && hallId.trim() ? hallId.trim() : "";
  const keys = useSyncExternalStore(
    subscribeOwnerPublishedSlots,
    () => (scoped ? getOwnerPublishedSlots(scoped) : getEmptyOwnerPublishedSlots()),
    getEmptyOwnerPublishedSlots,
  );

  useEffect(() => {
    if (!scoped) return;

    const onPublished = (event: Event) => {
      const detail = (event as CustomEvent<BookingPublishedDetail>).detail;
      if (!detail?.hallId || detail.hallId !== scoped) return;
      mergeOwnerPublishedSlots(scoped, detail.date, detail.periods ?? []);
    };

    window.addEventListener(BOOKING_PUBLISHED_EVENT, onPublished);
    return () => {
      window.removeEventListener(BOOKING_PUBLISHED_EVENT, onPublished);
    };
  }, [scoped]);

  return keys;
}
