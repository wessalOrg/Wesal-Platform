"use client";

import { useEffect, useId, useRef } from "react";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";

export type ModerationSuccessVariant = "postDeleted" | "userRestricted";

type ModerationSuccessModalProps = {
  open: boolean;
  variant: ModerationSuccessVariant;
  title?: string;
  body?: string;
  /** Extra block under the body (user card / restricted capabilities). */
  children?: React.ReactNode;
  onClose: () => void;
};

export default function ModerationSuccessModal({
  open,
  variant,
  title,
  body,
  children,
  onClose,
}: ModerationSuccessModalProps) {
  const t = useT();
  const titleId = useId();
  const descId = useId();
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    const frame = window.requestAnimationFrame(() => okRef.current?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
    };
  }, [open, onClose]);

  if (!open) return null;

  const resolvedTitle =
    title ||
    (variant === "postDeleted"
      ? t("admin.moderation.delete.successTitle")
      : t("admin.moderation.restrict.successTitle"));
  const resolvedBody =
    body ||
    (variant === "postDeleted"
      ? t("admin.moderation.delete.successBody")
      : t("admin.moderation.restrict.successBody"));

  return (
    <div
      className="fixed inset-0 z-[150]"
      role="presentation"
      data-testid={`moderation-success-${variant}`}
    >
      <button
        type="button"
        className="absolute inset-0 bg-[rgba(40,25,20,0.45)] backdrop-blur-[2px]"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="relative z-10 w-full max-w-[26rem] overflow-hidden rounded-t-[1.25rem] border border-[var(--wesal-border)] bg-white px-5 pb-5 pt-4 shadow-[0_1.5rem_3.75rem_rgba(60,35,30,0.2)] sm:rounded-[1.25rem] sm:px-6 sm:pb-6 sm:pt-5"
        >
          <button
            type="button"
            className="absolute start-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-[var(--wesal-muted)] transition hover:bg-[var(--wesal-pink-soft)]"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <CloseIcon />
          </button>

          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,#12b76a_16%,white)]">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#12b76a] text-white">
              <CheckIcon />
            </span>
          </div>

          <h2
            id={titleId}
            className="mt-4 text-center text-lg font-extrabold text-[var(--wesal-text)]"
          >
            {resolvedTitle}
          </h2>
          <p
            id={descId}
            className="mt-2 text-center text-sm leading-6 text-[var(--wesal-muted)]"
          >
            {resolvedBody}
          </p>

          {children ? <div className="mt-4">{children}</div> : null}

          <button
            ref={okRef}
            type="button"
            className="btn-primary mt-5 min-h-11 w-full"
            onClick={onClose}
            data-testid="moderation-success-ok"
          >
            {t("admin.moderation.success.ok")}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="m6.5 12.5 3.2 3.2 7.8-7.8"
        stroke="currentColor"
        strokeWidth="2.2"
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
