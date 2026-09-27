"use client";

import { useBookingOwnerChat } from "@/hooks/useBookingOwnerChat";
import { useT } from "@/i18n";
import type { UserBooking } from "@/types/booking";

type BookingPaymentNoticeButtonProps = {
  booking: UserBooking;
  compact?: boolean;
};

export default function BookingPaymentNoticeButton({
  booking,
  compact = false,
}: BookingPaymentNoticeButtonProps) {
  const t = useT();
  const { openForBooking, busyId, starting, error } = useBookingOwnerChat();
  const busy = busyId === booking.bookingId || starting;

  return (
    <div className="min-w-0">
      <button
        type="button"
        className={`btn-primary w-full !min-h-11 text-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:!min-h-10 ${
          compact ? "" : "lg:min-w-[8.5rem]"
        }`}
        disabled={busy}
        aria-busy={busy}
        data-testid={`booking-attach-payment-${booking.bookingId}`}
        onClick={() => {
          if (busy) return;
          void openForBooking(booking);
        }}
      >
        {busy ? t("bookings.attachPaymentOpening") : t("bookings.attachPayment")}
      </button>
      {error ? (
        <p className="mt-1 text-xs leading-5 text-[#a86267]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
