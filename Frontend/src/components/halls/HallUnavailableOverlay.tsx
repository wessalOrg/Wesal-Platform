"use client";

import { useT } from "@/i18n";

type HallUnavailableOverlayProps = {
  hallName?: string | null;
  onDismiss?: () => void;
};

/** Full-page / modal blocked state for public hall details (Edit 16 mockup #2). */
export default function HallUnavailableOverlay({
  hallName,
  onDismiss,
}: HallUnavailableOverlayProps) {
  const t = useT();

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="hall-unavailable-overlay-title"
      aria-describedby="hall-unavailable-overlay-body"
      data-testid="hall-unavailable-overlay"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-[0_18px_40px_rgba(90,55,45,0.18)]">
        <span
          className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f8e9ea] text-[#c62828]"
          aria-hidden="true"
        >
          <LockIcon />
        </span>
        <h2
          id="hall-unavailable-overlay-title"
          className="mt-3 text-base font-extrabold text-[var(--wesal-text)]"
        >
          {t("halls.details.unavailableTitle")}
        </h2>
        <p
          id="hall-unavailable-overlay-body"
          className="mt-2 text-sm leading-7 text-[var(--wesal-muted)]"
        >
          {hallName
            ? `${hallName} — ${t("halls.details.unavailableDesc")}`
            : t("halls.details.unavailableDesc")}
        </p>
        {onDismiss ? (
          <button
            type="button"
            className="btn-primary mt-5 w-full !bg-[var(--wesal-maroon-dark)]"
            onClick={onDismiss}
          >
            {t("common.ok")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <rect x="6" y="10" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8.5 10V8a3.5 3.5 0 0 1 7 0v2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
