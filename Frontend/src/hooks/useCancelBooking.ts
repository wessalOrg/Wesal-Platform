"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useAuthenticatedRequestScope } from "@/hooks/useAuthenticatedRequestScope";
import { BookingError } from "@/lib/booking-errors";
import { executeCancelBooking } from "@/lib/booking-cancel-command";
import { finalizedStatusFromError } from "@/lib/booking-cancel-errors";
import { canCancelBooking } from "@/lib/booking-status";
import type { BookingStatus, CancelBookingResult, UserBooking } from "@/types/booking";

export type CancelBookingOutcome =
  | { ok: true; result: CancelBookingResult }
  | { ok: false; skipped: true; status: BookingStatus }
  | { ok: false; skipped?: false; status: BookingStatus; error: BookingError };

export function useCancelBooking() {
  const { scope, isCurrent } = useAuthenticatedRequestScope();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [lockedIds, setLockedIds] = useState<Record<string, true>>({});
  const inFlight = useRef<string | null>(null);
  const lockedRef = useRef(lockedIds);
  useLayoutEffect(() => { inFlight.current = null; }, [scope]);
  const [previousScope, setPreviousScope] = useState(scope);
  if (previousScope !== scope) {
    setPreviousScope(scope); setCancellingId(null); setErrorKey(null);
    setSuccessId(null); setFeedbackId(null); setLockedIds({});
  }
  useLayoutEffect(() => {
    lockedRef.current = lockedIds;
  });

  const resetFeedback = useCallback(() => {
    if (!isCurrent()) return;
    setErrorKey(null);
    setSuccessId(null);
    setFeedbackId(null);
  }, [isCurrent]);

  const isCancelLocked = useCallback(
    (bookingId: string) => isCurrent() && Boolean(lockedRef.current[bookingId]),
    [isCurrent],
  );

  const cancel = useCallback(async (booking: UserBooking): Promise<CancelBookingOutcome> => {
    if (!isCurrent() || !canCancelBooking(booking.status) || lockedRef.current[booking.bookingId]) {
      return { ok: false, skipped: true, status: booking.status };
    }
    if (inFlight.current) {
      return { ok: false, skipped: true, status: booking.status };
    }

    inFlight.current = booking.bookingId;
    const captured = scope.capture();
    const current = () => captured() && isCurrent();
    setCancellingId(booking.bookingId);
    setFeedbackId(booking.bookingId);
    setErrorKey(null);
    setSuccessId(null);

    try {
      const result = await executeCancelBooking({
        hallId: booking.hallId,
        bookingId: booking.bookingId,
        status: booking.status,
      });
      if (!current()) return { ok: false, skipped: true, status: booking.status };
      setSuccessId(result.bookingId);
      return { ok: true, result };
    } catch (err) {
      if (!current()) return { ok: false, skipped: true, status: booking.status };
      const error =
        err instanceof BookingError ? err : new BookingError("errors.booking.cancel.generic");
      setErrorKey(error.message);
      setSuccessId(null);
      if (error.status === 409) {
        setLockedIds((current) => ({ ...current, [booking.bookingId]: true }));
      }
      const finalized = finalizedStatusFromError(error);
      return { ok: false, status: finalized ?? booking.status, error };
    } finally {
      if (current()) {
        inFlight.current = null;
        setCancellingId(null);
      }
    }
  }, [isCurrent, scope]);

  return {
    cancellingId,
    errorKey,
    successId,
    feedbackId,
    cancel,
    resetFeedback,
    isCancelLocked,
    isCancelling: (bookingId: string) => cancellingId === bookingId,
  };
}
