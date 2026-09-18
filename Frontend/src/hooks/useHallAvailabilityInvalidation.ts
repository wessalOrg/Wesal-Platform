"use client";

import { useEffect } from "react";
import {
  BOOKING_CANCELLED_EVENT,
  BOOKING_DELETED_EVENT,
  BOOKING_PUBLISHED_EVENT,
  BOOKING_REJECTED_EVENT,
  type BookingCancelledDetail,
  type BookingDeletedDetail,
  type BookingPublishedDetail,
  type BookingRejectedDetail,
} from "@/lib/booking-events";

export function useHallAvailabilityInvalidation(hallId: string, onInvalidate: () => void) {
  useEffect(() => {
    const matchesHall = (hall?: string) => !hall || hall === hallId;

    const onCancelled = (event: Event) => {
      const detail = (event as CustomEvent<BookingCancelledDetail>).detail;
      if (!detail?.hallId || detail.hallId !== hallId) return;
      onInvalidate();
    };
    const onPublished = (event: Event) => {
      const detail = (event as CustomEvent<BookingPublishedDetail>).detail;
      if (!matchesHall(detail?.hallId)) return;
      onInvalidate();
    };
    const onDeleted = (event: Event) => {
      const detail = (event as CustomEvent<BookingDeletedDetail>).detail;
      if (!matchesHall(detail?.hallId)) return;
      onInvalidate();
    };
    const onRejected = (event: Event) => {
      const detail = (event as CustomEvent<BookingRejectedDetail>).detail;
      if (!matchesHall(detail?.hallId)) return;
      onInvalidate();
    };

    window.addEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
    window.addEventListener(BOOKING_PUBLISHED_EVENT, onPublished);
    window.addEventListener(BOOKING_DELETED_EVENT, onDeleted);
    window.addEventListener(BOOKING_REJECTED_EVENT, onRejected);
    return () => {
      window.removeEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
      window.removeEventListener(BOOKING_PUBLISHED_EVENT, onPublished);
      window.removeEventListener(BOOKING_DELETED_EVENT, onDeleted);
      window.removeEventListener(BOOKING_REJECTED_EVENT, onRejected);
    };
  }, [hallId, onInvalidate]);
}
