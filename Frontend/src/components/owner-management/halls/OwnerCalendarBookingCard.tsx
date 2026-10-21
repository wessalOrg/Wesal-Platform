"use client";

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
  const statusTone = statusBadgeTone(booking.statusKind);

  return (
    <article
      className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white p-3.5 shadow-[0_8px_22px_rgba(90,55,45,0.05)] sm:p-4"
      data-testid="owner-calendar-booking-card"
      data-booking-id={booking.id}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-bold ${statusTone.className}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${statusTone.dot}`} aria-hidden="true" />
          {t(statusTone.labelKey)}
        </span>
        <span
          dir="ltr"
          className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f0ed] px-2.5 py-1 text-[0.72rem] font-semibold text-[var(--wesal-text)]"
        >
          <ClockIcon />
          {booking.timeLabel}
        </span>
      </div>

      <div className="mt-3 flex min-w-0 items-start gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#efe8e2] sm:h-[4.5rem] sm:w-[4.5rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={booking.imageSrc}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-extrabold text-[var(--wesal-text)] sm:text-base">
            {booking.title}
          </h3>
          <ul className="mt-2 space-y-1.5 text-[0.78rem] text-[var(--wesal-muted)]">
            <li className="flex min-w-0 items-center gap-1.5">
              <UserIcon />
              <span className="truncate font-semibold text-[var(--wesal-text)]">{booking.customerName}</span>
            </li>
            {booking.guestsLabel ? (
              <li className="flex min-w-0 items-center gap-1.5">
                <GuestsIcon />
                <span>{booking.guestsLabel}</span>
              </li>
            ) : null}
            {booking.phone ? (
              <li className="flex min-w-0 items-center gap-1.5">
                <PhoneIcon />
                <span dir="ltr" className="font-semibold text-[var(--wesal-text)]">
                  {booking.phone}
                </span>
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      {(booking.totalAmount != null ||
        booking.depositAmount != null ||
        booking.remainingAmount != null) && (
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[#f7f4f1] px-2.5 py-2.5 text-center">
          <MoneyCell
            label={t("owner.calendar.money.total")}
            value={booking.totalAmount}
            tone="neutral"
          />
          <MoneyCell
            label={t("owner.calendar.money.deposit")}
            value={booking.depositAmount}
            tone="positive"
          />
          <MoneyCell
            label={t("owner.calendar.money.remaining")}
            value={booking.remainingAmount}
            tone="danger"
          />
        </div>
      )}

      <Link
        href={detailsHref}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--wesal-border)] bg-[#faf8f6] text-sm font-bold text-[var(--wesal-text)] transition hover:bg-[var(--wesal-pink-soft)]"
        data-testid={`owner-calendar-booking-details-${booking.id}`}
      >
        {t("owner.calendar.viewDetails")}
        <DetailsChevron />
      </Link>
    </article>
  );
}

function MoneyCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null | undefined;
  tone: "neutral" | "positive" | "danger";
}) {
  const color =
    tone === "positive"
      ? "text-[#1f8a4c]"
      : tone === "danger"
        ? "text-[#c0392b]"
        : "text-[var(--wesal-text)]";

  return (
    <div className="min-w-0">
      <p className="text-[0.62rem] font-medium text-[var(--wesal-muted)]">{label}</p>
      <p className={`mt-0.5 truncate text-[0.78rem] font-extrabold ${color}`} dir="ltr">
        {value == null ? "—" : `${formatDepositAmount(value)} ₪`}
      </p>
    </div>
  );
}

function statusBadgeTone(kind: OwnerCalendarBookingCardModel["statusKind"]): {
  className: string;
  dot: string;
  labelKey: string;
} {
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
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--wesal-maroon)]" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8.25v4.1l2.6 1.55" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--wesal-maroon)]" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5.5 18.5c1.6-3 4-4.5 6.5-4.5s4.9 1.5 6.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GuestsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--wesal-maroon)]" fill="none" aria-hidden="true">
      <circle cx="9" cy="8.5" r="2.6" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="15.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.8 18c1.2-2.4 3-3.6 5.2-3.6s4 1.2 5.2 3.6M13.2 14.6c1.1-.5 2.4-.7 3.8-.4 1.5.3 2.7 1.2 3.5 2.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-[var(--wesal-maroon)]" fill="none" aria-hidden="true">
      <path
        d="M8.2 4.8h2.1l1.1 3.2-1.4 1.1a12.4 12.4 0 0 0 4.9 4.9l1.1-1.4 3.2 1.1v2.1c0 .7-.5 1.3-1.2 1.4-6.9.9-12.7-4.9-11.8-11.8.1-.7.7-1.2 1.4-1.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DetailsChevron() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-[var(--wesal-maroon)] rtl:rotate-180" fill="none" aria-hidden="true">
      <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
