"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useT } from "@/i18n";
import { formatDepositAmount } from "@/lib/booking-deposits";
import type { OwnerCalendarBookingCardModel } from "@/lib/owner-calendar-bookings";

type OwnerCalendarBookingCardProps = {
  booking: OwnerCalendarBookingCardModel;
  detailsHref: string;
};

export default function OwnerCalendarBookingCard({
  booking,
  detailsHref,
}: OwnerCalendarBookingCardProps) {
  const t = useT();
  const statusTone = statusBadgeTone(booking.statusKind, booking.depositAmount != null);
  const avatarLetter = booking.customerName.trim().charAt(0) || "؟";
  const bookingRef = shortBookingRef(booking.id);
  const phoneDigits = booking.phone?.replace(/[^\d+]/g, "") || "";
  const telHref = phoneDigits ? `tel:${phoneDigits}` : null;
  const priceLabel =
    booking.totalAmount != null ? formatDepositAmount(booking.totalAmount) : null;
  const depositLabel =
    booking.depositAmount != null ? formatDepositAmount(booking.depositAmount) : null;
  const remainingLabel =
    booking.remainingAmount != null ? formatDepositAmount(booking.remainingAmount) : null;
  const showMoneyRow = depositLabel != null || remainingLabel != null;
  const detailItems = [
    booking.title
      ? {
          key: "occasion",
          icon: <OccasionIcon />,
          text: t("owner.calendar.detail.occasion", { value: booking.title }),
        }
      : null,
    booking.guestsLabel
      ? {
          key: "guests",
          icon: <GuestsIcon />,
          text: booking.guestsLabel,
        }
      : null,
    booking.timeLabel
      ? {
          key: "time",
          icon: <ClockIcon />,
          text: t("owner.calendar.detail.time", { value: booking.timeLabel }),
        }
      : null,
    priceLabel
      ? {
          key: "price",
          icon: <PriceIcon />,
          text: t("owner.calendar.detail.price", { value: priceLabel }),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; icon: ReactNode; text: string }>;

  return (
    <article
      className="overflow-hidden rounded-2xl border border-[rgba(166,99,99,0.45)] bg-white p-3.5 shadow-[0_8px_22px_rgba(90,55,45,0.05)] sm:p-4"
      data-testid="owner-calendar-booking-card"
      data-booking-id={booking.id}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--wesal-maroon)] text-base font-extrabold text-white"
            aria-hidden="true"
          >
            {avatarLetter}
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <p className="truncate text-sm font-extrabold text-[var(--wesal-text)]">
                {booking.customerName}
              </p>
              {bookingRef ? (
                <p className="text-[0.72rem] font-semibold text-[var(--wesal-muted)]">
                  {t("owner.calendar.bookingRef", { id: bookingRef })}
                </p>
              ) : null}
            </div>
            {booking.phone ? (
              <p
                dir="ltr"
                className="mt-0.5 truncate text-start text-[0.78rem] font-semibold text-[var(--wesal-text)]"
              >
                {booking.phone}
              </p>
            ) : null}
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold ${statusTone.className}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${statusTone.dot}`} aria-hidden="true" />
          {t(statusTone.labelKey)}
        </span>
      </div>

      {detailItems.length > 0 ? (
        <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-[#f4f2f0] px-3 py-2.5 sm:grid-cols-2">
          {detailItems.map((item) => (
            <div
              key={item.key}
              className="flex min-w-0 items-center gap-1.5 text-[0.78rem] font-semibold text-[var(--wesal-text)]"
            >
              <span className="text-[var(--wesal-maroon)]" aria-hidden="true">
                {item.icon}
              </span>
              <span className="truncate">{item.text}</span>
            </div>
          ))}
        </div>
      ) : null}

      {showMoneyRow ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.78rem] font-bold">
          {depositLabel != null ? (
            <span className="text-[#1f8a4c]">
              {t("owner.calendar.money.depositPaidLine", { amount: depositLabel })}
            </span>
          ) : null}
          {depositLabel != null && remainingLabel != null ? (
            <span className="text-[var(--wesal-muted)]" aria-hidden="true">
              ·
            </span>
          ) : null}
          {remainingLabel != null ? (
            <span className="text-[var(--wesal-maroon)]">
              {t("owner.calendar.money.remainingLine", { amount: remainingLabel })}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={`mt-3 grid gap-2 ${telHref ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
        <Link
          href={detailsHref}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--wesal-maroon)] px-3 text-sm font-bold text-white transition hover:opacity-95"
          data-testid={`owner-calendar-booking-details-${booking.id}`}
        >
          <EyeIcon />
          {t("owner.calendar.viewBookingDetails")}
        </Link>
        {telHref ? (
          <a
            href={telHref}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[rgba(166,99,99,0.35)] bg-[#faf6f2] px-3 text-sm font-bold text-[var(--wesal-text)] transition hover:bg-[var(--wesal-pink-soft)]"
            data-testid={`owner-calendar-booking-contact-${booking.id}`}
          >
            <PhoneIcon />
            {t("owner.notifications.contactCustomer")}
          </a>
        ) : null}
      </div>
    </article>
  );
}

function shortBookingRef(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return "";
  if (trimmed.includes("-hours-")) return "";
  return trimmed.length <= 10 ? trimmed : trimmed.slice(0, 8);
}

function statusBadgeTone(
  kind: OwnerCalendarBookingCardModel["statusKind"],
  hasDeposit: boolean,
): {
  className: string;
  dot: string;
  labelKey: string;
} {
  if (kind === "confirmed" && hasDeposit) {
    return {
      className: "bg-[#f5edd8] text-[#9a7a28]",
      dot: "bg-[#c9a227]",
      labelKey: "owner.calendar.status.depositPaid",
    };
  }
  if (kind === "confirmed") {
    return {
      className: "bg-[#e8f7ee] text-[#1f8a4c]",
      dot: "bg-[#1f8a4c]",
      labelKey: "owner.calendar.status.confirmed",
    };
  }
  if (kind === "deposit") {
    return {
      className: "bg-[#fff4e5] text-[#b86a0a]",
      dot: "bg-[#d97706]",
      labelKey: "owner.calendar.status.deposit",
    };
  }
  return {
    className: "bg-[#f3f0ed] text-[var(--wesal-muted)]",
    dot: "bg-[var(--wesal-muted)]",
    labelKey: "owner.calendar.status.pending",
  };
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8.25v4.1l2.6 1.55" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function OccasionIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M12 3.5 13.7 8h4.6l-3.7 2.9 1.4 4.6L12 13.4 7.9 15.5l1.4-4.6L5.6 8h4.6L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GuestsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
      <circle cx="9" cy="8.5" r="2.6" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="15.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.8 18c1.2-2.4 3-3.6 5.2-3.6s4 1.2 5.2 3.6M13.2 14.6c1.1-.5 2.4-.7 3.8-.4 1.5.3 2.7 1.2 3.5 2.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M8.5 7.5h7.2a2 2 0 0 1 1.9 2.6l-1.4 4.2a2 2 0 0 1-1.9 1.4H9.2a2 2 0 0 1-1.9-1.4L6 10.1A2 2 0 0 1 8.5 7.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 7.5V6.2A2.2 2.2 0 0 1 11.2 4h1.6A2.2 2.2 0 0 1 15 6.2V7.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--wesal-maroon)]" fill="none" aria-hidden="true">
      <path
        d="M8.2 4.8h2.1l1.1 3.2-1.4 1.1a12.4 12.4 0 0 0 4.9 4.9l1.1-1.4 3.2 1.1v2.1c0 .7-.5 1.3-1.2 1.4-6.9.9-12.7-4.9-11.8-11.8.1-.7.7-1.2 1.4-1.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
      <path
        d="M2.8 12s3.4-6 9.2-6 9.2 6 9.2 6-3.4 6-9.2 6-9.2-6-9.2-6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
