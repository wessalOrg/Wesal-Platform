"use client";

import { useEffect, useId, useRef } from "react";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import "@/components/halls/notifications/hall-notifications.css";
import "@/components/halls/schedule/owner-deletion.css";

export type DeleteConfirmationDialogProps = {
  open: boolean;
  busy?: boolean;
  errorKey?: string | null;
  hallName?: string;
  dateLabel?: string;
  periodLabels?: string[];
  onClose: () => void;
  onConfirm: () => void;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function DeleteConfirmationDialog({
  open,
  busy = false,
  errorKey = null,
  hallName,
  dateLabel,
  periodLabels = [],
  onClose,
  onConfirm,
}: DeleteConfirmationDialogProps) {
  const t = useT();
  const titleId = useId();
  const descId = useId();
  const errorId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockBodyScroll();
    window.setTimeout(() => confirmRef.current?.focus(), 40);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => !node.hasAttribute("disabled") && node.getAttribute("aria-disabled") !== "true",
      );
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      unlockBodyScroll();
      previousFocusRef.current?.focus();
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const apiError =
    errorKey && (errorKey.startsWith("errors.") || errorKey.startsWith("owner."))
      ? t(errorKey)
      : errorKey;
  const hasContext = Boolean(hallName || dateLabel || periodLabels.length);

  return (
    <div
      className="fixed inset-0 z-[140]"
      role="presentation"
      data-testid="hall-delete-booking-modal"
    >
      <button
        type="button"
        className="owner-deletion-backdrop absolute inset-0 bg-[rgba(40,25,20,0.5)] backdrop-blur-[2px]"
        aria-label={t("common.close")}
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="owner-deletion-sheet relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--wesal-border)] bg-white shadow-[0_24px_60px_rgba(60,35,30,0.2)] sm:max-w-lg sm:rounded-3xl"
        >
          <div
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--wesal-border)] sm:hidden"
            aria-hidden="true"
          />
          <header className="shrink-0 border-b border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-3 sm:px-5 sm:py-4">
            <h2
              id={titleId}
              className="break-words text-base font-bold text-[var(--wesal-maroon)] [overflow-wrap:anywhere] sm:text-lg"
            >
              {t("owner.schedule.deleteTitle")}
            </h2>
            <p className="mt-1 break-words text-sm leading-6 text-[var(--wesal-muted)] [overflow-wrap:anywhere]">
              {t("owner.schedule.deleteHint")}
            </p>
          </header>

          <div className="owner-deletion-body space-y-3 px-4 py-4 sm:px-5">
            <p
              id={descId}
              className="break-words text-sm leading-7 text-[var(--wesal-text)] [overflow-wrap:anywhere]"
            >
              {t("owner.schedule.deleteConfirm")}
            </p>
            {hasContext ? (
              <dl className="space-y-2 rounded-2xl bg-[var(--wesal-pink-soft)] px-3.5 py-3 text-sm">
                {hallName ? (
                  <div className="min-w-0">
                    <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
                      {t("owner.schedule.deleteHall")}
                    </dt>
                    <dd className="mt-0.5 break-words font-semibold text-[var(--wesal-text)] [overflow-wrap:anywhere]">
                      {hallName}
                    </dd>
                  </div>
                ) : null}
                {dateLabel ? (
                  <div className="min-w-0">
                    <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
                      {t("owner.notifications.date")}
                    </dt>
                    <dd className="mt-0.5 break-words font-semibold text-[var(--wesal-text)] [overflow-wrap:anywhere]">
                      {dateLabel}
                    </dd>
                  </div>
                ) : null}
                {periodLabels.length > 0 ? (
                  <div className="min-w-0">
                    <dt className="text-[0.68rem] font-medium text-[var(--wesal-muted)]">
                      {t("owner.notifications.periods")}
                    </dt>
                    <dd className="mt-0.5 break-words font-semibold text-[var(--wesal-text)] [overflow-wrap:anywhere]">
                      {periodLabels.join(" · ")}
                    </dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            {busy ? (
              <p className="sr-only" role="status" aria-live="polite">
                {t("owner.schedule.deleting")}
              </p>
            ) : null}

            {apiError ? (
              <p
                id={errorId}
                className="break-words rounded-xl bg-red-50 px-3 py-2 text-sm leading-6 text-red-700 [overflow-wrap:anywhere]"
                role="alert"
              >
                {apiError}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[var(--wesal-border)] px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-5 sm:pb-4">
            <button
              type="button"
              className="btn-outline min-h-11 w-full sm:w-auto"
              disabled={busy}
              aria-disabled={busy || undefined}
              onClick={() => {
                if (!busy) onClose();
              }}
            >
              {t("common.close")}
            </button>
            <button
              ref={confirmRef}
              type="button"
              className="btn-primary min-h-11 w-full gap-2 sm:w-auto"
              disabled={busy}
              aria-busy={busy || undefined}
              aria-disabled={busy || undefined}
              aria-describedby={apiError ? errorId : descId}
              data-testid="hall-delete-booking-confirm"
              onClick={() => {
                if (busy) return;
                onConfirm();
              }}
            >
              {busy ? (
                <>
                  <Spinner />
                  {t("owner.schedule.deleting")}
                </>
              ) : (
                t("owner.schedule.deleteConfirmAction")
              )}
            </button>
          </div>
        </div>
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
