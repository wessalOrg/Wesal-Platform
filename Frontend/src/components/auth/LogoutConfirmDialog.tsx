"use client";

import { useEffect, useId, useRef } from "react";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";

type LogoutConfirmDialogProps = {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function LogoutConfirmDialog({
  open,
  busy = false,
  onClose,
  onConfirm,
}: LogoutConfirmDialogProps) {
  const t = useT();
  const titleId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    const frame = window.requestAnimationFrame(() => {
      confirmRef.current?.focus();
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [busy, onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140]" role="presentation" data-testid="logout-confirm-dialog">
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
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--wesal-border)] bg-white shadow-[0_24px_60px_rgba(60,35,30,0.2)] sm:rounded-3xl"
        >
          <div className="flex items-center justify-between gap-3 border-b border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-5 py-4">
            <h2 id={titleId} className="text-lg font-bold text-[var(--wesal-maroon)]">
              {t("auth.logout.confirmTitle")}
            </h2>
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--wesal-maroon)] transition hover:bg-white/80 disabled:opacity-60"
              aria-label={t("common.close")}
              disabled={busy}
              data-testid="logout-confirm-close"
              onClick={() => {
                if (!busy) onClose();
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="space-y-5 px-5 py-5">
            <p className="text-sm leading-7 text-[var(--wesal-text)]">
              {t("auth.logout.confirmMessage")}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-outline w-full sm:w-auto"
                disabled={busy}
                data-testid="logout-confirm-no"
                onClick={() => {
                  if (!busy) onClose();
                }}
              >
                {t("auth.logout.stayAction")}
              </button>
              <button
                ref={confirmRef}
                type="button"
                className="btn-primary w-full sm:w-auto"
                disabled={busy}
                aria-busy={busy || undefined}
                data-testid="logout-confirm-yes"
                onClick={() => {
                  if (!busy) onConfirm();
                }}
              >
                {t("auth.logout.confirmAction")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
