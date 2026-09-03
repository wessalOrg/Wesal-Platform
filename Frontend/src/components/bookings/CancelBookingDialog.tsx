"use client";

import { useEffect } from "react";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import type { UserBooking } from "@/types/booking";

type CancelBookingDialogProps = {
  booking: UserBooking | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function CancelBookingDialog({
  booking,
  busy,
  onClose,
  onConfirm,
}: CancelBookingDialogProps) {
  const t = useT();

  useEffect(() => {
    if (!booking) return;
    lockBodyScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [booking, busy, onClose]);

  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-[130]" role="presentation" data-testid="booking-cancel-dialog">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(40,25,20,0.45)]"
        aria-label={t("common.close")}
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-cancel-title"
          className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--wesal-border)] bg-white shadow-[0_24px_60px_rgba(60,35,30,0.2)] sm:rounded-3xl"
        >
          <div className="border-b border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-5 py-4">
            <h2 id="booking-cancel-title" className="text-lg font-bold text-[var(--wesal-maroon)]">
              {t("bookings.cancel.title")}
            </h2>
          </div>
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm leading-7 text-[var(--wesal-text)]">{t("bookings.cancel.confirm")}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-outline w-full sm:w-auto"
                disabled={busy}
                onClick={() => {
                  if (!busy) onClose();
                }}
              >
                {t("common.close")}
              </button>
              <button
                type="button"
                className="btn-primary w-full sm:w-auto"
                disabled={busy}
                aria-busy={busy}
                data-testid="booking-cancel-confirm"
                onClick={() => {
                  if (busy) return;
                  onConfirm();
                }}
              >
                {busy ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <BusySpinner />
                    {t("bookings.cancel.submitting")}
                  </span>
                ) : (
                  t("bookings.cancel.confirmAction")
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
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
