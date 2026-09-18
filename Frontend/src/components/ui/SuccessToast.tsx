"use client";

import { useEffect } from "react";
import { useT } from "@/i18n";

type SuccessToastProps = {
  open: boolean;
  message: string;
  onClose: () => void;
  /** Auto-dismiss delay in ms. */
  durationMs?: number;
};

/**
 * Fixed success toast for save confirmations (profile / password).
 */
export default function SuccessToast({
  open,
  message,
  onClose,
  durationMs = 3200,
}: SuccessToastProps) {
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [open, onClose, durationMs]);

  if (!open) return null;

  return (
    <div
      className="wesal-success-toast"
      role="status"
      aria-live="polite"
      data-testid="success-toast"
    >
      <span className="wesal-success-toast-icon" aria-hidden="true">
        <CheckIcon />
      </span>
      <p className="wesal-success-toast-message">{message}</p>
      <button
        type="button"
        className="wesal-success-toast-close"
        aria-label={t("common.close")}
        onClick={onClose}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="m6.5 12.5 3.2 3.2 7.8-7.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
