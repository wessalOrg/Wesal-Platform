"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCancelBooking } from "@/hooks/useCancelBooking";
import { BOOKING_CANCELLED_EVENT, type BookingCancelledDetail } from "@/lib/booking-events";
import { canCancelBooking } from "@/lib/booking-status";
import {
  loadRememberedBookings,
  patchRememberedBooking,
  rememberUserBookings,
  replaceRememberedBookings,
} from "@/lib/user-bookings-store";
import { fetchMyBookings } from "@/services/bookings";
import type { BookingStatus, UserBooking } from "@/types/booking";

const CACHE_TTL_MS = 45_000;

type BookingsCache = {
  bookings: UserBooking[];
  fetchedAt: number;
};

let sharedCache: BookingsCache | null = null;
let sharedInflight: Promise<UserBooking[]> | null = null;

function readWarmBookings(): UserBooking[] {
  if (sharedCache?.bookings.length) return sharedCache.bookings;
  return loadRememberedBookings();
}

function isCacheFresh() {
  return Boolean(sharedCache && Date.now() - sharedCache.fetchedAt < CACHE_TTL_MS);
}

function publishCache(next: UserBooking[]) {
  sharedCache = { bookings: next, fetchedAt: Date.now() };
  replaceRememberedBookings(next);
}

/** Prefetch bookings into the shared cache while the seeker shell is idle. */
export function warmUserBookings(): void {
  if (isCacheFresh() || sharedInflight) return;
  sharedInflight = fetchMyBookings()
    .then((next) => {
      publishCache(next);
      return next;
    })
    .catch(() => readWarmBookings())
    .finally(() => {
      sharedInflight = null;
    });
}

export function useUserBookings() {
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const cancellation = useCancelBooking();

  const reload = useCallback(async (opts?: { force?: boolean }) => {
    if (!opts?.force && isCacheFresh() && sharedCache) {
      setBookings(sharedCache.bookings);
      setStatus("ready");
      return;
    }

    try {
      if (!sharedInflight) {
        sharedInflight = fetchMyBookings().finally(() => {
          sharedInflight = null;
        });
      }
      const next = await sharedInflight;
      publishCache(next);
      setBookings(next);
      setStatus("ready");
    } catch {
      setStatus((current) => (current === "ready" ? current : "error"));
    }
  }, []);

  useEffect(() => {
    const warm = readWarmBookings();
    if (warm.length > 0) {
      setBookings(warm);
      setStatus("ready");
    }
    void reload({ force: !isCacheFresh() });
  }, [reload]);

  const applyStatus = useCallback((bookingId: string, next: BookingStatus) => {
    setBookings((current) => {
      const updated = current.map((item) =>
        item.bookingId === bookingId ? { ...item, status: next } : item,
      );
      if (sharedCache) {
        sharedCache = { bookings: updated, fetchedAt: sharedCache.fetchedAt };
      }
      return updated;
    });
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
      const merged = [
        ...items,
        ...current.filter((item) => !items.some((created) => created.bookingId === item.bookingId)),
      ];
      sharedCache = { bookings: merged, fetchedAt: Date.now() };
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
    reload: () => reload({ force: true }),
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
