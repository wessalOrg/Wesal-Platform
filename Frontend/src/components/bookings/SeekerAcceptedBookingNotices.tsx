"use client";

import { useBookingOwnerChat } from "@/hooks/useBookingOwnerChat";
import { useUserBookings } from "@/hooks/useUserBookings";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { formatDepositAmount } from "@/lib/booking-deposits";
import { bookingWhenLabels } from "@/lib/booking-when-label";
import { localizeHallName } from "@/lib/localize-hall-display";
import type { UserBooking } from "@/types/booking";

type SeekerAcceptedBookingNoticesProps = {
  limit?: number;
  onOpened?: () => void;
};

export default function SeekerAcceptedBookingNotices({
  limit,
  onOpened,
}: SeekerAcceptedBookingNoticesProps) {
  const bookingsState = useUserBookings();
  const accepted = bookingsState.bookings.filter((item) => item.status === "Accepted");
  const items = typeof limit === "number" ? accepted.slice(0, limit) : accepted;

  if (items.length === 0) return null;

  return (
    <>
      {items.map((booking) => (
        <li key={`accepted-${booking.bookingId}`}>
          <SeekerAcceptedNoticeButton booking={booking} onOpened={onOpened} />
        </li>
      ))}
    </>
  );
}

function SeekerAcceptedNoticeButton({
  booking,
  onOpened,
}: {
  booking: UserBooking;
  onOpened?: () => void;
}) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const { openForBooking, busyId, starting } = useBookingOwnerChat();
  const busy = busyId === booking.bookingId || starting;
  const hallName = localizeHallName(booking.hallId, booking.hallName, lang) || t("common.hall");
  const when = bookingWhenLabels(booking, t, locale).join(" · ");

  return (
    <button
      type="button"
      className="seeker-notify-item w-full text-start"
      data-testid={`seeker-accepted-notice-${booking.bookingId}`}
      disabled={busy}
      aria-busy={busy}
      onClick={() => {
        void openForBooking(booking).then((thread) => {
          if (thread) onOpened?.();
        });
      }}
    >
      <span className="seeker-notify-item-icon" aria-hidden="true">
        <BellMiniIcon />
      </span>
      <span className="seeker-notify-item-copy">
        <span className="seeker-notify-item-title">{t("bookings.paymentNotice.title")}</span>
        <span className="seeker-notify-item-body">
          {t("bookings.paymentNotice.body", {
            hallName,
            date: formatBookingDateLabel(booking.date, locale),
            period: when || t("halls.period.generic"),
            amount:
              booking.depositAmount != null
                ? formatDepositAmount(booking.depositAmount)
                : "—",
          })}
        </span>
      </span>
    </button>
  );
}

function BellMiniIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M7 10a5 5 0 0 1 10 0v2.6l1.1 1.9H5.9L7 12.6V10Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10.2 17.5a1.8 1.8 0 0 0 3.6 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

