"use client";

import { useState } from "react";
import BookingRequestRow from "@/components/bookings/BookingRequestRow";
import CancelBookingDialog from "@/components/bookings/CancelBookingDialog";
import { useBookingViewport } from "@/hooks/useBookingViewport";
import { useUserBookings } from "@/hooks/useUserBookings";
import { useT } from "@/i18n";
import { isPendingCancelGroup } from "@/lib/booking-cancel-ui";
import type { UserBooking } from "@/types/booking";

type UserBookingsListProps = {
  compact?: boolean;
};

export default function UserBookingsList({ compact = false }: UserBookingsListProps) {
  const t = useT();
  const viewport = useBookingViewport();
  const bookingsState = useUserBookings();
  const [pendingCancel, setPendingCancel] = useState<UserBooking | null>(null);

  if (bookingsState.status === "loading") {
    return (
      <div
        className="h-28 animate-pulse rounded-2xl bg-white/80"
        aria-busy="true"
        data-testid="user-bookings-loading"
      />
    );
  }

  if (bookingsState.status === "error") {
    return (
      <section className="rounded-2xl bg-white px-4 py-4" data-testid="user-bookings-error">
        <p className="text-sm text-[var(--wesal-muted)]">{t("errors.booking.list")}</p>
        <button type="button" className="btn-outline mt-3" onClick={() => void bookingsState.reload()}>
          {t("common.retry")}
        </button>
      </section>
    );
  }

  const pending = bookingsState.bookings.filter((item) =>
    isPendingCancelGroup(item.status, bookingsState.isCancelLocked(item.bookingId)),
  );
  const other = bookingsState.bookings.filter(
    (item) => !isPendingCancelGroup(item.status, bookingsState.isCancelLocked(item.bookingId)),
  );

  return (
    <section className={compact ? "mt-6" : undefined} data-testid="user-bookings-list">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[var(--wesal-maroon)]">{t("bookings.title")}</h2>
      </div>

      {pending.length === 0 && other.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-4 text-sm text-[var(--wesal-muted)]">
          {t("bookings.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {pending.length > 0 ? (
            <ul className="space-y-3" data-testid="user-bookings-pending">
              {pending.map((booking) => (
                <li key={booking.bookingId}>
                  <BookingRow
                    booking={booking}
                    bookingsState={bookingsState}
                    viewport={viewport}
                    onAskCancel={setPendingCancel}
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {other.length > 0 ? (
            <ul className="space-y-3" data-testid="user-bookings-other">
              {other.map((booking) => (
                <li key={booking.bookingId}>
                  <BookingRow
                    booking={booking}
                    bookingsState={bookingsState}
                    viewport={viewport}
                    onAskCancel={setPendingCancel}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <CancelBookingDialog
        booking={pendingCancel}
        busy={Boolean(pendingCancel && bookingsState.cancellingId === pendingCancel.bookingId)}
        onClose={() => {
          if (!bookingsState.cancellingId) setPendingCancel(null);
        }}
        onConfirm={() => {
          if (!pendingCancel || bookingsState.cancellingId) return;
          void bookingsState.cancelBooking(pendingCancel).finally(() => {
            setPendingCancel(null);
          });
        }}
      />
    </section>
  );
}

function BookingRow({
  booking,
  bookingsState,
  viewport,
  onAskCancel,
}: {
  booking: UserBooking;
  bookingsState: ReturnType<typeof useUserBookings>;
  viewport: ReturnType<typeof useBookingViewport>;
  onAskCancel: (booking: UserBooking) => void;
}) {
  return (
    <BookingRequestRow
      booking={booking}
      cancellingId={bookingsState.cancellingId}
      feedbackId={bookingsState.feedbackId}
      errorKey={bookingsState.cancelError}
      successId={bookingsState.cancelSuccessId}
      locked={bookingsState.isCancelLocked(booking.bookingId)}
      viewport={viewport}
      onCancel={onAskCancel}
      onDismissError={bookingsState.resetCancelFeedback}
      onRetry={onAskCancel}
    />
  );
}
