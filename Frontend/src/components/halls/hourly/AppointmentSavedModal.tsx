"use client";

import { useEffect } from "react";
import { useT } from "@/i18n";

const SUMMARY_SELECTOR = "[data-testid='hall-action-card']";

type AppointmentSavedModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function AppointmentSavedModal({ open, onClose }: AppointmentSavedModalProps) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const goToSummary = () => {
    onClose();
    window.setTimeout(() => {
      document.querySelector(SUMMARY_SELECTOR)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-[120]" role="presentation" data-testid="appointment-saved-modal">
      <button
        type="button"
        className="appointment-saved-backdrop absolute inset-0 bg-[rgba(40,25,20,0.45)]"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-saved-title"
        className="appointment-saved-panel absolute inset-x-4 top-1/2 mx-auto w-auto max-w-[26rem] -translate-y-1/2 rounded-[28px] bg-white px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(60,35,30,0.22)] sm:px-6 sm:pb-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f6e4e6] text-[var(--wesal-maroon)] transition hover:bg-[#efd4d7]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <img
          src="/assistant/appointment-saved-mabrouk.jpg"
          alt=""
          width={512}
          height={512}
          aria-hidden="true"
          className="mx-auto mt-1 h-56 w-full max-w-[19rem] object-contain"
        />

        <h2
          id="appointment-saved-title"
          className="mt-1 flex items-center justify-center gap-2 text-center text-[1.65rem] font-extrabold leading-tight text-[var(--wesal-maroon)]"
        >
          <span>{t("halls.hourly.savedTitle")}</span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f6e4e6] text-sm">
            ✓
          </span>
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-7 text-[#7a736e]">
          {t("halls.hourly.savedBody")}
        </p>

        <button
          type="button"
          onClick={goToSummary}
          className="btn-primary mt-5 flex min-h-12 w-full items-center justify-center gap-2 !rounded-2xl text-[15px]"
          data-testid="appointment-saved-go-summary"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{t("halls.hourly.goToSummary")}</span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="btn-outline mt-3 min-h-12 w-full !rounded-2xl text-[15px] font-bold"
          data-testid="appointment-saved-stay"
        >
          {t("halls.hourly.stayOnPage")}
        </button>
        <span className="sr-only">{t("halls.hourly.savedImageAlt")}</span>
      </div>
    </div>
  );
}
