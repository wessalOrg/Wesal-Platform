"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import {
  REJECTION_REASON_MAX,
  rejectionReasonMessageKey,
  validateRejectionReason,
} from "@/lib/owner-rejection-ui";

type RejectionReasonModalProps = {
  open: boolean;
  busy?: boolean;
  errorKey?: string | null;
  dateLabel?: string;
  periodLabels?: string[];
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

export default function RejectionReasonModal({
  open,
  busy = false,
  errorKey = null,
  dateLabel,
  periodLabels = [],
  onClose,
  onConfirm,
}: RejectionReasonModalProps) {
  const t = useT();
  const titleId = useId();
  const inputId = useId();
  const errorId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [issue, setIssue] = useState<"required" | "tooLong" | null>(null);

  useEffect(() => {
    if (!open) {
      setReason("");
      setIssue(null);
      return;
    }

    lockBodyScroll();
    const node = textareaRef.current;
    window.setTimeout(() => node?.focus(), 40);

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      unlockBodyScroll();
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const validationText = issue ? t(rejectionReasonMessageKey(issue)) : null;
  const apiError =
    errorKey && (errorKey.startsWith("errors.") || errorKey.startsWith("owner."))
      ? t(errorKey)
      : errorKey;
  const invalid = Boolean(validationText);

  const resize = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 192)}px`;
  };

  return (
    <div
      className="fixed inset-0 z-[140]"
      role="presentation"
      data-testid="hall-rejection-modal"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(40,25,20,0.5)] backdrop-blur-[2px]"
        aria-label={t("common.close")}
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <form
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--wesal-border)] bg-white shadow-[0_24px_60px_rgba(60,35,30,0.2)] sm:rounded-3xl"
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            const nextIssue = validateRejectionReason(reason);
            setIssue(nextIssue);
            if (nextIssue) return;
            onConfirm(reason.trim());
          }}
        >
          <header className="border-b border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-3 sm:px-5 sm:py-4">
            <h2
              id={titleId}
              className="text-base font-bold text-[var(--wesal-maroon)] sm:text-lg"
            >
              {t("owner.notifications.rejectTitle")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--wesal-muted)]">
              {t("owner.notifications.rejectHint")}
            </p>
          </header>

          <div className="space-y-3 px-4 py-4 sm:px-5">
            {dateLabel || periodLabels.length > 0 ? (
              <p className="break-words text-sm leading-6 text-[var(--wesal-text)] [overflow-wrap:anywhere]">
                {[dateLabel, periodLabels.join(" · ")].filter(Boolean).join(" — ")}
              </p>
            ) : null}

            <label htmlFor={inputId} className="block text-sm font-semibold text-[var(--wesal-text)]">
              {t("owner.notifications.rejectReason")}
            </label>
            <textarea
              ref={textareaRef}
              id={inputId}
              name="rejectionReason"
              rows={4}
              maxLength={REJECTION_REASON_MAX}
              disabled={busy}
              aria-invalid={invalid || undefined}
              aria-required="true"
              aria-describedby={invalid || apiError ? errorId : undefined}
              className="min-h-[7.5rem] max-h-48 w-full resize-y overflow-y-auto rounded-2xl border border-[var(--wesal-border)] bg-white px-3 py-3 text-sm leading-6 text-[var(--wesal-text)] [overflow-wrap:anywhere] break-words outline-none focus:border-[var(--wesal-maroon)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wesal-maroon)] disabled:opacity-60"
              placeholder={t("owner.notifications.rejectPlaceholder")}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (issue) setIssue(validateRejectionReason(event.target.value));
                resize(event.target);
              }}
            />
            <p className="text-[0.68rem] text-[var(--wesal-muted)]">
              {reason.trim().length}/{REJECTION_REASON_MAX}
            </p>

            {validationText || apiError ? (
              <p id={errorId} className="rounded-xl bg-red-50 px-3 py-2 text-sm leading-6 text-red-700" role="alert">
                {validationText ?? apiError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--wesal-border)] px-4 py-4 sm:flex-row sm:justify-end sm:px-5">
            <button
              type="button"
              className="btn-outline min-h-11 w-full sm:w-auto"
              disabled={busy}
              onClick={() => {
                if (!busy) onClose();
              }}
            >
              {t("common.close")}
            </button>
            <button
              type="submit"
              className="btn-primary min-h-11 w-full gap-2 sm:w-auto"
              disabled={busy}
              aria-busy={busy || undefined}
              aria-disabled={busy || undefined}
              data-testid="hall-rejection-confirm"
            >
              {busy ? (
                <>
                  <Spinner />
                  {t("owner.notifications.rejecting")}
                </>
              ) : (
                t("owner.notifications.rejectConfirm")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 1-9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
