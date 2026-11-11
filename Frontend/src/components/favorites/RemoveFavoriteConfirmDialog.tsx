"use client";

import { useEffect, useId, useRef } from "react";
import MabroukFigure from "@/components/brand/MabroukFigure";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";

export type RemoveFavoriteConfirmDialogProps = {
  open: boolean;
  title: string;
  body: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function RemoveFavoriteConfirmDialog({
  open,
  title,
  body,
  busy = false,
  onClose,
  onConfirm,
}: RemoveFavoriteConfirmDialogProps) {
  const t = useT();
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
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
        (node) => !node.hasAttribute("disabled"),
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140]"
      role="presentation"
      data-testid="remove-favorite-modal"
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
          className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--wesal-border)] bg-white px-5 pb-5 pt-4 shadow-[0_24px_60px_rgba(60,35,30,0.2)] sm:rounded-3xl sm:px-6 sm:pb-6"
        >
          <button
            type="button"
            className="absolute start-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-[var(--wesal-muted)] hover:bg-[var(--wesal-pink-soft)]"
            aria-label={t("common.close")}
            disabled={busy}
            onClick={() => {
              if (!busy) onClose();
            }}
          >
            ×
          </button>

          <div
            className="mx-auto mt-1 flex max-w-[18rem] items-end justify-center gap-1 sm:gap-2"
            aria-hidden="true"
          >
            <MabroukFigure
              pose="removeConfirm"
              size="md"
              rounded="2xl"
              className="!h-[7.5rem] !w-[7.5rem] shadow-[0_0.5rem_1.25rem_rgba(90,55,45,0.1)]"
            />
            <span className="mb-4 inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,#b42318_12%,white)] text-[#b42318] shadow-[0_0.35rem_0.85rem_rgba(180,35,24,0.12)] ring-1 ring-[#f5c6c2]">
              <TrashIcon className="h-6 w-6" />
            </span>
          </div>

          <h2
            id={titleId}
            className="mt-3 text-center text-lg font-extrabold text-[var(--wesal-maroon)]"
          >
            {title}
          </h2>
          <p
            id={descId}
            className="mt-2 text-center text-sm leading-6 text-[var(--wesal-muted)]"
          >
            {body}
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              ref={cancelRef}
              type="button"
              className="btn-outline min-h-11"
              disabled={busy}
              onClick={onClose}
            >
              {t("seeker.favorites.confirmCancel")}
            </button>
            <button
              type="button"
              className="btn-primary inline-flex min-h-11 items-center justify-center gap-2"
              disabled={busy}
              onClick={onConfirm}
              data-testid="remove-favorite-confirm"
            >
              <TrashIcon />
              {busy
                ? t("seeker.favorites.removing")
                : t("seeker.favorites.confirmRemove")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrashIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M5 7h14M10 7V5h4v2M8 7v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
