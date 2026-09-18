"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  BOOKING_ACCEPTED_EVENT,
  BOOKING_PUBLISHED_EVENT,
  BOOKING_REJECTED_EVENT,
  type BookingAcceptedDetail,
  type BookingPublishedDetail,
  type BookingRejectedDetail,
} from "@/lib/booking-events";
import {
  getEmptyOwnerDepositSlots,
  getOwnerDepositSlots,
  mergeOwnerDepositSlotsFromAccept,
  releaseOwnerDepositSlots,
  subscribeOwnerDepositSlots,
} from "@/lib/owner-deposit-slot-store";

/**
 * Reads deposit-pending schedule overlay published by the notifications container.
 * Does not fetch or mutate booking requests.
 */
export function useOwnerDepositSchedule(hallId: string, enabled: boolean) {
  const scoped = enabled && hallId.trim() ? hallId.trim() : "";
  const keys = useSyncExternalStore(
    subscribeOwnerDepositSlots,
    () => (scoped ? getOwnerDepositSlots(scoped) : getEmptyOwnerDepositSlots()),
    getEmptyOwnerDepositSlots,
  );

  useEffect(() => {
    if (!scoped) return;

    const onAccepted = (event: Event) => {
      const detail = (event as CustomEvent<BookingAcceptedDetail>).detail;
      if (!detail?.hallId || detail.hallId !== scoped) return;
      mergeOwnerDepositSlotsFromAccept(scoped, detail.date, detail.periods ?? []);
    };

    const onRejected = (event: Event) => {
      const detail = (event as CustomEvent<BookingRejectedDetail>).detail;
      if (!detail?.hallId || detail.hallId !== scoped) return;
      releaseOwnerDepositSlots(scoped, detail.date, detail.periods ?? []);
    };

    const onPublished = (event: Event) => {
      const detail = (event as CustomEvent<BookingPublishedDetail>).detail;
      if (!detail?.hallId || detail.hallId !== scoped) return;
      releaseOwnerDepositSlots(scoped, detail.date, detail.periods ?? []);
    };

    window.addEventListener(BOOKING_ACCEPTED_EVENT, onAccepted);
    window.addEventListener(BOOKING_REJECTED_EVENT, onRejected);
    window.addEventListener(BOOKING_PUBLISHED_EVENT, onPublished);
    return () => {
      window.removeEventListener(BOOKING_ACCEPTED_EVENT, onAccepted);
      window.removeEventListener(BOOKING_REJECTED_EVENT, onRejected);
      window.removeEventListener(BOOKING_PUBLISHED_EVENT, onPublished);
    };
  }, [scoped]);

  return keys;
}
