"use client";

import { useT } from "@/i18n";
import { formatBookingDateLabel } from "@/lib/booking-date";
import { bookingPeriodI18nKey } from "@/lib/booking-rejection-message";
import { bookingStatusMessageKey } from "@/lib/booking-status";
import { useCancelInteraction } from "@/hooks/useCancelInteraction";
import type { BookingViewport } from "@/hooks/useBookingViewport";
import { useUiLang } from "@/components/layout/LanguageProvider";
import type { BookingStatus, UserBooking } from "@/types/booking";

type BookingRequestRowProps = {
  booking: UserBooking;
  cancellingId?: string | null;
  feedbackId?: string | null;
  errorKey?: string | null;
  successId?: string | null;
  locked?: boolean;
  viewport?: BookingViewport;
  onCancel?: (booking: UserBooking) => void;
  onDismissError?: () => void;
  onRetry?: (booking: UserBooking) => void;
};

export default function BookingRequestRow({
  booking,
  cancellingId = null,
  feedbackId = null,
  errorKey = null,
  successId = null,
  locked = false,
  viewport = "mobile",
  onCancel,
  onDismissError,
  onRetry,
}: BookingRequestRowProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  const ui = useCancelInteraction({
    bookingId: booking.bookingId,
    status: booking.status,
    cancellingId,
    feedbackId,
    errorKey,
    successId,
    locked,
  });
  const periodKey = bookingPeriodI18nKey(booking.period);
  const compact = viewport === "mobile";

  const message =
    ui.errorKey && (ui.errorKey.startsWith("errors.") || ui.errorKey.startsWith("bookings."))
      ? t(ui.errorKey)
      : ui.errorKey;

  return (
    <article
      className="rounded-2xl border border-[var(--wesal-border)] bg-white px-4 py-3 shadow-[0_8px_20px_rgba(90,55,45,0.06)] sm:px-5 sm:py-4"
      data-testid={`booking-row-${booking.bookingId}`}
      data-booking-status={booking.status}
      data-cancel-phase={ui.phase}
      data-booking-layout={viewport}
    >
      <div
        className={
          compact
            ? "flex min-w-0 flex-col gap-3"
            : "flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        }
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--wesal-maroon)] sm:text-base">
            {booking.hallName || t("common.hall")}
          </p>
          <p className="mt-1 text-xs leading-6 text-[var(--wesal-muted)] sm:text-sm">
            {formatBookingDateLabel(booking.date, locale)}
            {" · "}
            {periodKey ? t(periodKey) : booking.period}
          </p>
        </div>

        <div
          className={
            compact
              ? "flex flex-col gap-3"
              : "flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:gap-3"
          }
        >
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <StatusPill status={booking.status} />
            {ui.phase === "finalized" && ui.showRaceAlert ? (
              <span className="rounded-full bg-[var(--wesal-pink-soft)] px-2.5 py-1 text-[0.7rem] font-bold text-[var(--wesal-maroon)]">
                {t("bookings.cancel.finalizedBadge")}
              </span>
            ) : null}
          </div>

          {ui.showCancel ? (
            <button
              type="button"
              className="btn-outline w-full !min-h-11 text-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:!min-h-10 lg:min-w-[8.5rem]"
              disabled={ui.cancelDisabled}
              aria-busy={ui.phase === "cancelling"}
              data-testid={`booking-cancel-${booking.bookingId}`}
              onClick={() => {
                if (ui.cancelDisabled) return;
                onCancel?.(booking);
              }}
            >
              {ui.phase === "cancelling" ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <BusySpinner />
                  {t("bookings.cancel.submitting")}
                </span>
              ) : (
                t("bookings.cancel.action")
              )}
            </button>
          ) : null}
        </div>
      </div>

      {ui.showCancelledNotice ? (
        <p
          className="mt-3 text-sm font-medium text-[var(--wesal-maroon)]"
          role="status"
          data-testid="booking-cancel-success"
        >
          {t("bookings.cancel.success")}
        </p>
      ) : null}

      {ui.showRaceAlert && message ? (
        <p
          className="mt-3 rounded-xl bg-[var(--wesal-pink-soft)] px-3 py-2 text-sm leading-6 text-[var(--wesal-maroon-dark)]"
          role="alert"
          data-testid="booking-cancel-finalized"
        >
          {message}
        </p>
      ) : null}

      {ui.showFailedAlert && message ? (
        <div
          className="mt-3 rounded-xl bg-red-50 px-3 py-2"
          role="alert"
          data-testid="booking-cancel-error"
        >
          <p className="text-sm leading-6 text-red-700">{message}</p>
          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-outline w-full sm:w-auto" onClick={onDismissError}>
              {t("common.close")}
            </button>
            <button
              type="button"
              className="btn-primary w-full sm:w-auto"
              data-testid={`booking-cancel-retry-${booking.bookingId}`}
              onClick={() => onRetry?.(booking)}
            >
              {t("common.retry")}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function StatusPill({ status }: { status: BookingStatus }) {
  const t = useT();
  const styles: Record<BookingStatus, string> = {
    Pending: "bg-[rgba(193,123,127,0.16)] text-[var(--wesal-maroon)]",
    Accepted: "bg-emerald-50 text-emerald-700",
    Rejected: "bg-[#fbf4f2] text-[var(--wesal-maroon-dark)]",
    Cancelled: "bg-[var(--wesal-pink-soft)] text-[var(--wesal-muted)]",
  };

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${styles[status]}`}
      data-testid="booking-status-pill"
    >
      {t(bookingStatusMessageKey(status))}
    </span>
  );
}

function BusySpinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
