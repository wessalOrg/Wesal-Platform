"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SEEKER_BOOKINGS_PATH } from "@/constants/seekerDashboardNav";
import { useT } from "@/i18n";

type HourlyBookingSentPopupProps = {
  open: boolean;
  onClose: () => void;
};

/** Confirmation after the seeker submits an hourly booking request. */
export default function HourlyBookingSentPopup({
  open,
  onClose,
}: HourlyBookingSentPopupProps) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[130]" role="presentation" data-testid="hourly-booking-sent-popup">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(40,25,20,0.45)]"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hourly-sent-title"
        className="absolute inset-x-4 top-1/2 mx-auto w-full max-w-sm -translate-y-1/2 rounded-3xl border border-[var(--wesal-gold)]/60 bg-white p-6 text-center shadow-[0_24px_60px_rgba(90,40,45,0.28)]"
      >
        <h2
          id="hourly-sent-title"
          className="text-lg font-extrabold text-[var(--wesal-maroon)]"
        >
          {t("notify.bookingSubmitted.title")}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--wesal-text)]">
          {t("notify.bookingSubmitted.body")}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link href={SEEKER_BOOKINGS_PATH} className="btn-primary w-full" onClick={onClose}>
            {t("bookings.title")}
          </Link>
          <button
            type="button"
            className="btn-outline w-full"
            onClick={onClose}
            data-testid="hourly-booking-sent-close"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
