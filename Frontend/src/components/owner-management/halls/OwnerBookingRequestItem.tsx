"use client";

import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { bookingPeriodI18nKey } from "@/lib/booking-rejection-message";
import { bookingStatusMessageKey } from "@/lib/booking-status";
import type { BookingStatus } from "@/types/booking";
import type { OwnerHallBookingRequest } from "@/types/owner-hall-booking-requests";

type OwnerBookingRequestItemProps = {
  request: OwnerHallBookingRequest;
};

/**
 * Presentational owner notification row — display only (no approve/reject).
 */
export default function OwnerBookingRequestItem({
  request,
}: OwnerBookingRequestItemProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";

  return (
    <article
      className="owner-booking-request-item min-w-0 rounded-2xl border border-[var(--wesal-border)] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(90,55,45,0.06)] sm:px-5 sm:py-4"
      data-testid={`owner-booking-request-${request.id}`}
      data-request-id={request.id}
      data-hall-id={request.hallId}
      data-booking-status={request.status}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-bold text-[var(--wesal-maroon)] sm:text-base">
            {request.requesterName}
          </p>
          <p className="mt-1 break-words text-xs leading-6 text-[var(--wesal-muted)] sm:text-sm">
            <span className="font-semibold text-[var(--wesal-text)]">
              {t("owner.management.notifications.dateLabel")}:{" "}
            </span>
            {formatBookingDateLabel(request.date, locale)}
          </p>
          <div className="mt-2 min-w-0">
            <p className="text-xs font-semibold text-[var(--wesal-text)] sm:text-sm">
              {t("owner.management.notifications.periodsLabel")}
            </p>
            <ul className="owner-booking-request-periods mt-1 flex min-w-0 flex-wrap gap-1.5">
              {request.periods.map((period) => {
                const periodKey = bookingPeriodI18nKey(period);
                return (
                  <li
                    key={`${request.id}-${period}`}
                    className="rounded-full bg-[var(--wesal-pink-soft)] px-2.5 py-1 text-[0.7rem] font-bold text-[var(--wesal-maroon)]"
                  >
                    {periodKey ? t(periodKey) : period}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <OwnerRequestStatusPill status={request.status} />
      </div>
    </article>
  );
}

function OwnerRequestStatusPill({ status }: { status: BookingStatus }) {
  const t = useT();
  const styles: Record<BookingStatus, string> = {
    Pending: "bg-[rgba(193,123,127,0.16)] text-[var(--wesal-maroon)]",
    Accepted: "bg-emerald-50 text-emerald-700",
    Rejected: "bg-[#fbf4f2] text-[var(--wesal-maroon-dark)]",
    Cancelled: "bg-[var(--wesal-pink-soft)] text-[var(--wesal-muted)]",
  };

  return (
    <span
      className={`shrink-0 self-start rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${styles[status]}`}
      data-testid="owner-booking-status-pill"
    >
      {t(bookingStatusMessageKey(status))}
    </span>
  );
}
