"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useT } from "@/i18n";
import { formatDepositAmount } from "@/lib/booking-deposits";
import type { OwnerCalendarBookingCardModel } from "@/lib/owner-calendar-bookings";

type OwnerCalendarBookingCardProps = {
  booking: OwnerCalendarBookingCardModel;
  detailsHref: string;
  onMessageSeeker?: (booking: OwnerCalendarBookingCardModel) => void;
  messagingSeeker?: boolean;
};

export default function OwnerCalendarBookingCard({
  booking,
  detailsHref,
  onMessageSeeker,
  messagingSeeker = false,
}: OwnerCalendarBookingCardProps) {
  const t = useT();
  const statusTone = statusBadgeTone(booking.statusKind, booking.depositAmount != null);
  const avatarLetter = booking.customerName.trim().charAt(0) || "؟";
  const showChat = Boolean(onMessageSeeker) && Boolean(booking.requesterUserId?.trim());
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
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-base font-extrabold text-white"
            aria-hidden="true"
          >
            {avatarLetter}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-[var(--wesal-text)]">
              {booking.customerName}
            </p>
            {booking.phone ? (
              <p
                dir="ltr"
                className="mt-0.5 truncate text-start text-[0.78rem] font-semibold text-[var(--wesal-text)]"
              >
                {booking.phone}
              </p>
            ) : (
              <p className="mt-0.5 text-[0.72rem] font-semibold text-[var(--wesal-muted)]">
                {t("owner.notifications.valueMissing")}
              </p>
            )}
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

      <div className={`mt-3 grid gap-2 ${showChat ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
        <Link
          href={detailsHref}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--wesal-maroon)] px-3 text-sm font-bold text-white transition hover:opacity-95"
          data-testid={`owner-calendar-booking-details-${booking.id}`}
        >
          <EyeIcon />
          {t("owner.calendar.viewBookingDetails")}
        </Link>
        {showChat ? (
          <button
            type="button"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[rgba(166,99,99,0.35)] bg-[#faf6f2] px-3 text-sm font-bold text-[var(--wesal-text)] transition hover:bg-[var(--wesal-pink-soft)] disabled:opacity-60"
            disabled={messagingSeeker}
            aria-busy={messagingSeeker || undefined}
            data-testid={`owner-calendar-booking-contact-${booking.id}`}
            onClick={() => onMessageSeeker?.(booking)}
          >
            <ChatIcon />
            {messagingSeeker
              ? t("owner.notifications.chatWithSeekerOpening")
              : t("owner.notifications.contactCustomer")}
          </button>
        ) : null}
      </div>
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

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[var(--wesal-maroon)]" fill="none" aria-hidden="true">
      <path
        d="M5 6.5h14v9.5H9.2L5 19.2V6.5Z"
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
