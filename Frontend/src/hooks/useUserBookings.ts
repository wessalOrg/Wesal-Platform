"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuthenticatedRequestScope } from "@/hooks/useAuthenticatedRequestScope";
import { isCurrentAuthenticatedAccount, readAuthenticatedAccount, type AuthenticatedAccount } from "@/lib/authenticated-account";
import { useCancelBooking } from "@/hooks/useCancelBooking";
import {
  BOOKING_ACCEPTED_EVENT,
  BOOKING_CANCELLED_EVENT,
  BOOKING_PUBLISHED_EVENT,
  BOOKING_REJECTED_EVENT,
  emitBookingAccepted,
  type BookingAcceptedDetail,
  type BookingCancelledDetail,
  type BookingPublishedDetail,
  type BookingRejectedDetail,
} from "@/lib/booking-events";
import { canCancelBooking } from "@/lib/booking-status";
import {
  loadRememberedBookings,
  patchRememberedBooking,
  rememberUserBookings,
  replaceRememberedBookings,
  USER_BOOKINGS_CHANGED_EVENT,
} from "@/lib/user-bookings-store";
import { fetchMyBookings } from "@/services/bookings";
import type { BookingStatus, UserBooking } from "@/types/booking";

const CACHE_TTL_MS = 45_000;

type BookingsCache = {
  bookings: UserBooking[];
  fetchedAt: number;
};

type AccountBookings = { cache: BookingsCache | null; inflight: Promise<UserBooking[]> | null };
const accounts = new WeakMap<AuthenticatedAccount, AccountBookings>();
function accountBookings(account: AuthenticatedAccount): AccountBookings {
  let bucket = accounts.get(account);
  if (!bucket) { bucket = { cache: null, inflight: null }; accounts.set(account, bucket); }
  return bucket;
}
function readWarmBookings(account: AuthenticatedAccount | null): UserBooking[] {
  if (!account || !isCurrentAuthenticatedAccount(account)) return [];
  return accountBookings(account).cache?.bookings ?? loadRememberedBookings();
}
function isCacheFresh(account: AuthenticatedAccount | null) {
  const cache = account ? accountBookings(account).cache : null;
  return Boolean(cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS);
}
function publishCache(account: AuthenticatedAccount, next: UserBooking[]) {
  if (!isCurrentAuthenticatedAccount(account)) return;
  accountBookings(account).cache = { bookings: next, fetchedAt: Date.now() };
  replaceRememberedBookings(next);
}
function loadBookings(account: AuthenticatedAccount): Promise<UserBooking[]> {
  const bucket = accountBookings(account);
  if (bucket.inflight) return bucket.inflight;
  const pending = fetchMyBookings().then(next => { publishCache(account, next); return next; }).finally(() => {
    if (bucket.inflight === pending) bucket.inflight = null;
  });
  bucket.inflight = pending;
  return pending;
}
/** Prefetch only for the current continuous login. */
export function warmUserBookings(): void {
  const account = readAuthenticatedAccount();
  if (!account || isCacheFresh(account)) return;
  void loadBookings(account).catch(() => undefined);
}

export function useUserBookings() {
  const { account, scope, isCurrent } = useAuthenticatedRequestScope();
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(account ? "loading" : "ready");
  const cancellation = useCancelBooking();
  const knownStatusRef = useRef<Map<string, BookingStatus>>(new Map());
  const primedRef = useRef(false);

  const [previousScope, setPreviousScope] = useState(scope);
  if (previousScope !== scope) {
    setPreviousScope(scope); setBookings([]); setStatus(account ? "loading" : "ready");
  }
  useLayoutEffect(() => {
    knownStatusRef.current = new Map(); primedRef.current = false;
  }, [scope]);

  const reload = useCallback(async (opts?: { force?: boolean }) => {
    if (!account || !isCurrent()) return;
    const captured = scope.capture();
    const current = () => captured() && isCurrent();
    const bucket = accountBookings(account);
    if (!opts?.force && isCacheFresh(account) && bucket.cache) {
      setBookings(bucket.cache.bookings);
      setStatus("ready");
      return;
    }

    try {
      const next = await loadBookings(account);
      if (!current()) return;
      setBookings(next);
      setStatus("ready");
    } catch {
      if (!current()) return;
      setStatus((current) => (current === "ready" ? current : "error"));
    }
  }, [account, isCurrent, scope]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!isCurrent()) return;
      const warm = readWarmBookings(account);
      if (warm.length > 0) {
        setBookings(warm);
        setStatus("ready");
      }
      void reload({ force: !isCacheFresh(account) });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload, account, isCurrent]);

  const applyStatus = useCallback((
    bookingId: string,
    next: BookingStatus,
    extra?: { rejectionReason?: string | null; depositAmount?: number | null },
  ) => {
    if (!account || !isCurrent()) return;
    const bucket = accountBookings(account);
    const reason = extra?.rejectionReason?.trim();
    setBookings((current) => {
      const updated = current.map((item) =>
        item.bookingId === bookingId
          ? {
              ...item,
              status: next,
              ...(reason ? { rejectionReason: reason } : {}),
              ...(extra && "depositAmount" in extra ? { depositAmount: extra.depositAmount } : {}),
            }
          : item,
      );
      if (bucket.cache) {
        bucket.cache = { bookings: updated, fetchedAt: bucket.cache.fetchedAt };
      }
      return updated;
    });
    patchRememberedBooking(bookingId, next, extra);
  }, [account, isCurrent]);

  useEffect(() => {
    const onCancelled = (event: Event) => {
      const detail = (event as CustomEvent<BookingCancelledDetail>).detail;
      if (!detail?.bookingId) return;
      applyStatus(detail.bookingId, "Cancelled");
    };
    const onRejected = (event: Event) => {
      const detail = (event as CustomEvent<BookingRejectedDetail>).detail;
      if (!detail?.bookingId) return;
      applyStatus(detail.bookingId, "Rejected", { rejectionReason: detail.rejectionReason });
    };
    const onAccepted = (event: Event) => {
      const detail = (event as CustomEvent<BookingAcceptedDetail>).detail;
      if (!detail?.bookingId) return;
      applyStatus(detail.bookingId, "Accepted", { depositAmount: detail.depositAmount });
    };
    const onPublished = (event: Event) => {
      const detail = (event as CustomEvent<BookingPublishedDetail>).detail;
      if (!detail?.bookingId) return;
      applyStatus(detail.bookingId, "Confirmed");
    };
    const onRemembered = () => {
      if (!account || !isCurrent()) return;
      const bucket = accountBookings(account);
      const next = loadRememberedBookings();
      setBookings(next);
      if (bucket.cache) {
        bucket.cache = { bookings: next, fetchedAt: bucket.cache.fetchedAt };
      }
    };
    window.addEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
    window.addEventListener(BOOKING_REJECTED_EVENT, onRejected);
    window.addEventListener(BOOKING_ACCEPTED_EVENT, onAccepted);
    window.addEventListener(BOOKING_PUBLISHED_EVENT, onPublished);
    window.addEventListener(USER_BOOKINGS_CHANGED_EVENT, onRemembered);
    return () => {
      window.removeEventListener(BOOKING_CANCELLED_EVENT, onCancelled);
      window.removeEventListener(BOOKING_REJECTED_EVENT, onRejected);
      window.removeEventListener(BOOKING_ACCEPTED_EVENT, onAccepted);
      window.removeEventListener(BOOKING_PUBLISHED_EVENT, onPublished);
      window.removeEventListener(USER_BOOKINGS_CHANGED_EVENT, onRemembered);
    };
  }, [applyStatus, account, isCurrent]);

  useEffect(() => {
    const known = knownStatusRef.current;
    if (!primedRef.current) {
      for (const item of bookings) {
        known.set(item.bookingId, item.status);
      }
      primedRef.current = bookings.length > 0 || status === "ready";
      return;
    }
    for (const item of bookings) {
      const previous = known.get(item.bookingId);
      if (previous === "Pending" && item.status === "Accepted") {
        emitBookingAccepted({
          bookingId: item.bookingId,
          hallId: item.hallId,
          date: item.date,
          periods: item.period ? [item.period] : [],
          hallName: item.hallName,
          depositAmount: item.depositAmount,
        });
      }
      known.set(item.bookingId, item.status);
    }
  }, [bookings, status]);

  useEffect(() => {
    const hasPending = bookings.some((item) => item.status === "Pending");
    if (!hasPending) return;
    const timer = window.setInterval(() => {
      void reload({ force: true });
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [bookings, reload]);

  const cancelBooking = useCallback(
    async (booking: UserBooking) => {
      if (!isCurrent() || !canCancelBooking(booking.status) || cancellation.isCancelLocked(booking.bookingId)) {
        return false;
      }

      const captured = scope.capture();
      const outcome = await cancellation.cancel(booking);
      if (!captured() || !isCurrent()) return false;
      if (outcome.ok) {
        applyStatus(booking.bookingId, "Cancelled");
        return true;
      }

      if (outcome.skipped) return false;

      applyStatus(booking.bookingId, outcome.status);
      return false;
    },
    [applyStatus, cancellation, isCurrent, scope],
  );

  const upsertFromCreated = useCallback((items: UserBooking[]) => {
    if (!account || !isCurrent()) return;
    rememberUserBookings(items);
    setBookings((current) => {
      const merged = [
        ...items,
        ...current.filter((item) => !items.some((created) => created.bookingId === item.bookingId)),
      ];
      accountBookings(account).cache = { bookings: merged, fetchedAt: Date.now() };
      return merged;
    });
  }, [account, isCurrent]);

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
