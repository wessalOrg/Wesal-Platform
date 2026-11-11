"use client";

import { useEffect, useId, useRef } from "react";
import MabroukFigure from "@/components/brand/MabroukFigure";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";

export type UnlockAccountTarget = {
  userId: string;
  displayName: string;
  roleLabel: string;
};

type UnlockAccountDialogProps = {
  open: boolean;
  busy?: boolean;
  errorKey?: string | null;
  target: UnlockAccountTarget | null;
  onClose: () => void;
  onConfirm: () => void;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Confirmation before lifting an account lock (15.3). */
export default function UnlockAccountDialog({
  open,
  busy = false,
  errorKey = null,
  target,
  onClose,
  onConfirm,
}: UnlockAccountDialogProps) {
  const t = useT();
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    window.setTimeout(() => confirmRef.current?.focus(), 40);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => !node.hasAttribute("disabled") && node.getAttribute("aria-disabled") !== "true",
      );
      if (nodes.length === 0) return;
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
    };
  }, [open, busy, onClose]);

  if (!open || !target) return null;

  const resolvedError =
    errorKey &&
    (errorKey.startsWith("admin.") ||
      errorKey.startsWith("errors.") ||
      errorKey.startsWith("common."))
      ? t(errorKey)
      : errorKey;

  return (
    <div
      className="fixed inset-0 z-[140]"
      role="presentation"
      data-testid="unlock-account-dialog"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(40,25,20,0.45)] backdrop-blur-[2px]"
        aria-label={t("common.close")}
        disabled={busy}
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="relative z-10 w-full max-w-[28rem] overflow-hidden rounded-t-[1.25rem] border border-[var(--wesal-border)] bg-white px-5 pb-5 pt-4 shadow-[0_1.5rem_3.75rem_rgba(60,35,30,0.22)] sm:rounded-[1.25rem] sm:px-6 sm:pb-6 sm:pt-5"
        >
          <button
            type="button"
            className="absolute start-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-[var(--wesal-muted)] transition hover:bg-[var(--wesal-pink-soft)]"
            aria-label={t("common.close")}
            disabled={busy}
            onClick={() => {
              if (!busy) onClose();
            }}
          >
            <CloseIcon />
          </button>

          <div className="mx-auto flex justify-center" aria-hidden="true">
            <MabroukFigure
              pose="confirmWarning"
              size="md"
              rounded="2xl"
              className="!h-28 !w-32 bg-transparent sm:!h-32 sm:!w-36"
            />
          </div>

          <h2
            id={titleId}
            className="mt-4 text-center text-lg font-extrabold text-[var(--wesal-text)]"
          >
            {t("admin.moderation.accountUnlock.title")}
          </h2>
          <p
            id={descId}
            className="mt-2 text-center text-sm leading-6 text-[var(--wesal-muted)]"
          >
            {t("admin.moderation.accountUnlock.body", {
              name: target.displayName,
              role: target.roleLabel,
            })}
          </p>

          <div className="mt-4 rounded-xl border border-[color-mix(in_srgb,var(--wesal-maroon)_18%,white)] bg-[color-mix(in_srgb,var(--wesal-maroon)_8%,white)] px-3 py-2.5 text-xs leading-5 text-[var(--wesal-maroon-dark)]">
            {t("admin.moderation.accountUnlock.warning")}
          </div>

          {resolvedError ? (
            <p className="mt-3 text-sm text-[#b42318]" role="alert">
              {resolvedError}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="btn-outline min-h-11"
              disabled={busy}
              onClick={() => {
                if (!busy) onClose();
              }}
            >
              {t("common.cancel")}
            </button>
            <button
              ref={confirmRef}
              type="button"
              className="btn-primary min-h-11"
              disabled={busy}
              data-testid="unlock-account-confirm"
              onClick={() => {
                if (!busy) onConfirm();
              }}
            >
              {busy
                ? t("admin.moderation.accountUnlock.busy")
                : t("admin.moderation.accountUnlock.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
