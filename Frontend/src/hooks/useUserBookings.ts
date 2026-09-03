"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCancelBooking } from "@/hooks/useCancelBooking";
import { BOOKING_CANCELLED_EVENT, type BookingCancelledDetail } from "@/lib/booking-events";
import { canCancelBooking } from "@/lib/booking-status";
import {
  patchRememberedBooking,
  rememberUserBookings,
} from "@/lib/user-bookings-store";
import { fetchMyBookings } from "@/services/bookings";
import type { BookingStatus, UserBooking } from "@/types/booking";

export function useUserBookings() {
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const cancellation = useCancelBooking();

  const reload = useCallback(async () => {
    setStatus("loading");
    try {
      const next = await fetchMyBookings();
      setBookings(next);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const applyStatus = useCallback((bookingId: string, next: BookingStatus) => {
    setBookings((current) =>
      current.map((item) => (item.bookingId === bookingId ? { ...item, status: next } : item)),
    );
    patchRememberedBooking(bookingId, next);
  }, []);

  useEffect(() => {
    const onCancelled = (event: Event) => {
      const detail = (event as CustomEvent<BookingCancelledDetail>).detail;
      if (!detail?.bookingId) return;
      applyStatus(detail.bookingId, "Cancelled");
    };
    window.addEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
    return () => window.removeEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
  }, [applyStatus]);

  const cancelBooking = useCallback(
    async (booking: UserBooking) => {
      if (!canCancelBooking(booking.status) || cancellation.isCancelLocked(booking.bookingId)) {
        return false;
      }

      const outcome = await cancellation.cancel(booking);
      if (outcome.ok) {
        applyStatus(booking.bookingId, "Cancelled");
        return true;
      }

      if (outcome.skipped) return false;

      applyStatus(booking.bookingId, outcome.status);
      return false;
    },
    [applyStatus, cancellation],
  );

  const upsertFromCreated = useCallback((items: UserBooking[]) => {
    rememberUserBookings(items);
    setBookings((current) => {
      const merged = [...items, ...current.filter((item) => !items.some((created) => created.bookingId === item.bookingId))];
      return merged;
    });
  }, []);

  const pending = useMemo(
    () => bookings.filter((item) => item.status === "Pending"),
    [bookings],
  );

  const visibleBookings = useMemo(
    () => [...pending, ...bookings.filter((item) => item.status !== "Pending")],
    [bookings, pending],
  );

  return {
    bookings: visibleBookings,
    pending,
    status,
    reload,
    cancelBooking,
    upsertFromCreated,
    cancellingId: cancellation.cancellingId,
    cancelError: cancellation.errorKey,
    cancelSuccessId: cancellation.successId,
    feedbackId: cancellation.feedbackId,
    resetCancelFeedback: cancellation.resetFeedback,
    isCancelLocked: cancellation.isCancelLocked,
  };
}
