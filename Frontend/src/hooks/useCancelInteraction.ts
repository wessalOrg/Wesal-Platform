"use client";

import { useMemo } from "react";
import { describeCancelUi, type CancelUiView } from "@/lib/booking-cancel-ui";
import type { BookingStatus } from "@/types/booking";

type CancelInteractionInput = {
  bookingId: string;
  status: BookingStatus;
  cancellingId: string | null;
  feedbackId: string | null;
  errorKey: string | null;
  successId: string | null;
  locked: boolean;
};

export function useCancelInteraction(input: CancelInteractionInput): CancelUiView {
  const {
    bookingId,
    status,
    cancellingId,
    feedbackId,
    errorKey,
    successId,
    locked,
  } = input;

  return useMemo(
    () =>
      describeCancelUi({
        status,
        cancelling: cancellingId === bookingId,
        locked,
        isFeedbackTarget: feedbackId === bookingId,
        errorKey,
        successId,
      }),
    [bookingId, status, cancellingId, feedbackId, errorKey, successId, locked],
  );
}
