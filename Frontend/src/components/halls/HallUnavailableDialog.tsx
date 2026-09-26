"use client";

import { useT } from "@/i18n";

type HallUnavailableDialogProps = {
  open: boolean;
  title: string;
  body: string;
  onClose: () => void;
  testId?: string;
};

export default function HallUnavailableDialog({
  open,
  title,
  body,
  onClose,
  testId = "hall-unavailable-dialog",
}: HallUnavailableDialogProps) {
  const t = useT();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4"
      role="presentation"
      data-testid={`${testId}-overlay`}
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
        aria-describedby={`${testId}-body`}
        className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-[0_18px_40px_rgba(90,55,45,0.18)]"
        data-testid={testId}
        onClick={(event) => event.stopPropagation()}
      >
        <span
          className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#f8e9ea] text-[#c62828]"
          aria-hidden="true"
        >
          <LockIcon />
        </span>
        <h2
          id={`${testId}-title`}
          className="mt-3 text-base font-extrabold text-[var(--wesal-text)]"
        >
          {title}
        </h2>
        <p
          id={`${testId}-body`}
          className="mt-2 text-sm leading-7 text-[var(--wesal-muted)]"
        >
          {body}
        </p>
        <button
          type="button"
          className="btn-primary mt-5 w-full !bg-[var(--wesal-maroon-dark)]"
          onClick={onClose}
        >
          {t("common.ok")}
        </button>
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
