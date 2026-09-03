"use client";

import { useEffect, useMemo, useState } from "react";
import BookingRequestRow from "@/components/bookings/BookingRequestRow";
import CancelBookingDialog from "@/components/bookings/CancelBookingDialog";
import { useBookingViewport } from "@/hooks/useBookingViewport";
import { useCancelBooking } from "@/hooks/useCancelBooking";
import { bookingsFromResult, patchRememberedBooking } from "@/lib/user-bookings-store";
import { isPendingCancelGroup } from "@/lib/booking-cancel-ui";
import type { BookingRequestResult, UserBooking } from "@/types/booking";

export default function CreatedBookingCancelList({ result }: { result: BookingRequestResult }) {
  const viewport = useBookingViewport();
  const initial = useMemo(() => bookingsFromResult(result), [result]);
  const [items, setItems] = useState<UserBooking[]>(initial);
  const cancellation = useCancelBooking();
  const [pending, setPending] = useState<UserBooking | null>(null);

  useEffect(() => {
    setItems(initial);
  }, [initial]);

  const apply = (bookingId: string, status: UserBooking["status"]) => {
    setItems((current) =>
      current.map((item) => (item.bookingId === bookingId ? { ...item, status } : item)),
    );
    patchRememberedBooking(bookingId, status);
  };

  const pendingItems = items.filter((item) =>
    isPendingCancelGroup(item.status, cancellation.isCancelLocked(item.bookingId)),
  );
  const otherItems = items.filter(
    (item) => !isPendingCancelGroup(item.status, cancellation.isCancelLocked(item.bookingId)),
  );

  return (
    <div className="mt-4 space-y-3" data-testid="created-booking-cancel-list">
      {pendingItems.length > 0 ? (
        <ul className="space-y-3" data-testid="created-bookings-pending">
          {pendingItems.map((booking) => (
            <li key={booking.bookingId}>
              <BookingRequestRow
                booking={booking}
                cancellingId={cancellation.cancellingId}
                feedbackId={cancellation.feedbackId}
                errorKey={cancellation.errorKey}
                successId={cancellation.successId}
                locked={cancellation.isCancelLocked(booking.bookingId)}
                viewport={viewport}
                onCancel={setPending}
                onDismissError={cancellation.resetFeedback}
                onRetry={setPending}
              />
            </li>
          ))}
        </ul>
      ) : null}
      {otherItems.length > 0 ? (
        <ul className="space-y-3" data-testid="created-bookings-other">
          {otherItems.map((booking) => (
            <li key={booking.bookingId}>
              <BookingRequestRow
                booking={booking}
                cancellingId={cancellation.cancellingId}
                feedbackId={cancellation.feedbackId}
                errorKey={cancellation.errorKey}
                successId={cancellation.successId}
                locked={cancellation.isCancelLocked(booking.bookingId)}
                viewport={viewport}
                onCancel={setPending}
                onDismissError={cancellation.resetFeedback}
                onRetry={setPending}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <CancelBookingDialog
        booking={pending}
        busy={Boolean(pending && cancellation.cancellingId === pending.bookingId)}
        onClose={() => {
          if (!cancellation.cancellingId) setPending(null);
        }}
        onConfirm={() => {
          if (!pending || cancellation.cancellingId) return;
          const target = pending;
          void cancellation.cancel(target).then((outcome) => {
            if (outcome.ok) apply(target.bookingId, "Cancelled");
            else if (!outcome.skipped) apply(target.bookingId, outcome.status);
            setPending(null);
          });
        }}
      />
    </div>
  );
}
