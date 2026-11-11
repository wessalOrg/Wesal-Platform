"use client";

import { useEffect, useId, useRef, useState } from "react";
import MabroukFigure from "@/components/brand/MabroukFigure";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import { MODERATION_REASON_MAX } from "@/types/admin-moderation";

type DeletePostModalProps = {
  open: boolean;
  busy?: boolean;
  errorKey?: string | null;
  contentLabel?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function DeletePostModal({
  open,
  busy = false,
  errorKey = null,
  contentLabel,
  onClose,
  onConfirm,
}: DeletePostModalProps) {
  const t = useT();
  const titleId = useId();
  const descId = useId();
  const reasonId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setTouched(false);
    lockBodyScroll();
    window.setTimeout(() => textareaRef.current?.focus(), 40);

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

  if (!open) return null;

  const trimmed = reason.trim();
  const showRequired = touched && !trimmed;
  const resolvedError =
    errorKey &&
    (errorKey.startsWith("admin.") ||
      errorKey.startsWith("errors.") ||
      errorKey.startsWith("common."))
      ? t(errorKey)
      : errorKey;

  return (
    <div className="fixed inset-0 z-[140]" role="presentation" data-testid="delete-post-modal">
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
          role="dialog"
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
            {t("admin.moderation.delete.title")}
          </h2>
          <p
            id={descId}
            className="mt-2 text-center text-sm leading-6 text-[var(--wesal-muted)]"
          >
            {contentLabel
              ? t("admin.moderation.delete.bodyNamed", { name: contentLabel })
              : t("admin.moderation.delete.body")}
          </p>

          <label
            htmlFor={reasonId}
            className="mt-4 block text-sm font-semibold text-[var(--wesal-text)]"
          >
            {t("admin.moderation.delete.reasonLabel")}{" "}
            <span className="text-[#b42318]" aria-hidden="true">
              *
            </span>
          </label>
          <div className="relative mt-1.5">
            <textarea
              ref={textareaRef}
              id={reasonId}
              rows={4}
              maxLength={MODERATION_REASON_MAX}
              value={reason}
              disabled={busy}
              placeholder={t("admin.moderation.delete.reasonPlaceholder")}
              className="w-full resize-none rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2.5 text-sm text-[var(--wesal-text)] outline-none transition focus:border-[var(--wesal-maroon)] disabled:opacity-60"
              aria-invalid={showRequired || undefined}
              aria-required="true"
              onChange={(event) => setReason(event.target.value)}
              onBlur={() => setTouched(true)}
              data-testid="delete-post-reason"
            />
            <p className="pointer-events-none absolute bottom-2 start-3 text-[0.7rem] text-[var(--wesal-muted)]">
              {reason.length}/{MODERATION_REASON_MAX}
            </p>
          </div>
          {showRequired ? (
            <p className="mt-1.5 text-sm text-[#b42318]" role="alert">
              {t("admin.moderation.delete.reasonRequired")}
            </p>
          ) : null}
          {resolvedError ? (
            <p className="mt-2 text-sm text-[#b42318]" role="alert">
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
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#8b2e2e] px-4 text-sm font-bold text-white transition hover:bg-[#732626] disabled:opacity-60"
              disabled={busy}
              data-testid="delete-post-confirm"
              onClick={() => {
                setTouched(true);
                if (!trimmed || busy) return;
                onConfirm(trimmed);
              }}
            >
              <TrashIcon className="h-4 w-4" />
              {busy
                ? t("admin.moderation.delete.busy")
                : t("admin.moderation.delete.confirm")}
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 4h6M5 7h14M9 7v12a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V7M10 11v5M14 11v5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
