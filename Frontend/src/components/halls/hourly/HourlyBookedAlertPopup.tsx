"use client";

import { useEffect } from "react";
import { useT } from "@/i18n";

/** Sad Mabrouk face shown in the popup. */
const MABROUK_FACE_SRC = "/assistant/wesal-ai-groom-sad.jpg";

type HourlyBookedAlertPopupProps = {
  open: boolean;
  message: string;
  onClose: () => void;
};

/** Popup shown when the chosen hours are already booked (site colors, Mabrouk face). */
export default function HourlyBookedAlertPopup({
  open,
  message,
  onClose,
}: HourlyBookedAlertPopupProps) {
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
    <div className="fixed inset-0 z-[130]" role="presentation" data-testid="hourly-booked-popup">
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(40,25,20,0.45)]"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="hourly-booked-message"
        className="absolute left-1/2 top-1/2 w-[min(24rem,calc(100vw-2rem))] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[var(--wesal-gold)]/60 bg-[var(--wesal-pink)] p-5 text-center shadow-[0_24px_60px_rgba(90,40,45,0.28)] sm:p-6"
      >
        <span
          className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-[3px] border-[var(--wesal-gold)] bg-white shadow-[0_8px_20px_rgba(193,123,127,0.28)]"
          aria-hidden="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- small decorative mascot */}
          <img
            src={MABROUK_FACE_SRC}
            alt=""
            draggable={false}
            className="h-full w-full scale-[1.12] object-cover"
          />
        </span>
        <p
          id="hourly-booked-message"
          className="mt-4 rounded-2xl border border-red-300/70 bg-white px-4 py-3 text-sm font-bold leading-7 text-red-700"
        >
          {message}
        </p>
        <button
          type="button"
          className="btn-primary mt-5 w-full"
          onClick={onClose}
          data-testid="hourly-booked-popup-close"
        >
          {t("common.close")}
        </button>
      </div>
    </div>
  );
}
