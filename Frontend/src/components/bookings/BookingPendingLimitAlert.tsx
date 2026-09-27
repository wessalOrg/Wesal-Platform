"use client";

import Link from "next/link";
import { SEEKER_BOOKINGS_PATH } from "@/constants/seekerDashboardNav";
import { useT } from "@/i18n";
import { PENDING_LIMIT_MESSAGE_KEY } from "@/lib/booking-pending-limit";

type BookingPendingLimitAlertProps = {
  className?: string;
};

export default function BookingPendingLimitAlert({
  className = "",
}: BookingPendingLimitAlertProps) {
  const t = useT();

  return (
    <div
      className={`rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ${className}`.trim()}
      role="alert"
      data-testid="hall-booking-pending-limit"
    >
      <p>{t(PENDING_LIMIT_MESSAGE_KEY)}</p>
      <Link
        href={SEEKER_BOOKINGS_PATH}
        className="mt-2 inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-3 text-sm font-semibold text-[var(--wesal-maroon)] ring-1 ring-[var(--wesal-border)] transition hover:bg-[var(--wesal-pink-soft)]"
        data-testid="hall-booking-pending-limit-cta"
      >
        {t("halls.booking.pendingLimitCta")}
      </Link>
    </div>
  );
}
