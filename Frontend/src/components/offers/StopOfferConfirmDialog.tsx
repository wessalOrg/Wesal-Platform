"use client";

import { useEffect, useId, useRef } from "react";
import MabroukFigure from "@/components/brand/MabroukFigure";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";

export type StopOfferConfirmDialogProps = {
  open: boolean;
  busy?: boolean;
  errorKey?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function StopOfferConfirmDialog({
  open,
  busy = false,
  errorKey = null,
  onClose,
  onConfirm,
}: StopOfferConfirmDialogProps) {
  const t = useT();
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    lockBodyScroll();
    window.setTimeout(() => cancelRef.current?.focus(), 40);

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
      previousFocusRef.current?.focus();
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const resolvedError =
    errorKey &&
    (errorKey.startsWith("offers.") ||
      errorKey.startsWith("errors.") ||
      errorKey.startsWith("owner."))
      ? t(errorKey)
      : errorKey;

  return (
    <div className="fixed inset-0 z-[140]" role="presentation" data-testid="stop-offer-modal">
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
          className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--wesal-border)] bg-white px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(60,35,30,0.2)] sm:rounded-3xl sm:px-6 sm:pb-6 sm:pt-5"
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
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
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
            className="mt-4 text-center text-lg font-extrabold text-[var(--wesal-maroon-dark)]"
          >
            {t("offers.stop.title")}
          </h2>
          <p
            id={descId}
            className="mt-2 text-center text-sm leading-6 text-[var(--wesal-muted)]"
          >
            {t("offers.stop.body")}
          </p>

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--wesal-maroon)_10%,white)] px-3 py-2.5 text-xs leading-5 text-[var(--wesal-maroon-dark)]">
            <span
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-[0.55rem] font-bold text-white"
              aria-hidden="true"
            >
              i
            </span>
            <p>
              {t("offers.stop.hintBefore")}
              <span className="underline underline-offset-2">{t("offers.stop.hintLink")}</span>
              {t("offers.stop.hintAfter")}
            </p>
          </div>

          {resolvedError ? (
            <p className="mt-3 text-center text-sm text-[#b42318]" role="alert">
              {resolvedError}
            </p>
          ) : null}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              ref={cancelRef}
              type="button"
              className="btn-outline min-h-11"
              disabled={busy}
              onClick={onClose}
            >
              {t("offers.stop.cancel")}
            </button>
            <button
              type="button"
              className="btn-primary min-h-11"
              disabled={busy}
              onClick={onConfirm}
              data-testid="stop-offer-confirm"
            >
              {busy ? t("offers.stop.busy") : t("offers.stop.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
