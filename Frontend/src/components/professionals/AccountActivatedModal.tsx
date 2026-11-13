"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import WesalLogo from "@/components/brand/WesalLogo";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";

type AccountActivatedModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function AccountActivatedModal({
  open,
  onClose,
}: AccountActivatedModalProps) {
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

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="pro-activated-overlay"
      role="presentation"
      data-testid="pro-account-activated-overlay"
    >
      <button
        type="button"
        className="pro-activated-backdrop"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div className="pro-activated-frame">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="pro-activated-card"
          data-testid="pro-account-activated-modal"
        >
          <div className="pro-activated-head">
            <div className="pro-activated-brand" aria-hidden="true">
              <WesalLogo className="h-8 w-auto" variant="brand" title={t("brand.name")} />
              <span className="pro-activated-brand-name">{t("brand.name")}</span>
            </div>
            <button
              type="button"
              className="pro-activated-close"
              aria-label={t("common.close")}
              onClick={onClose}
            >
              <CloseIcon />
            </button>
          </div>

          <div className="pro-activated-body">
            <div className="pro-activated-seal" aria-hidden="true">
              <span className="pro-activated-rays" />
              <span className="pro-activated-badge">
                <CheckIcon />
              </span>
            </div>

            <h2 id={titleId} className="pro-activated-title">
              <span className="pro-activated-title-mark" aria-hidden="true" />
              {t("pro.dash.activated.congrats")}
            </h2>
            <p id={descId} className="pro-activated-desc">
              {t("pro.dash.activated.success")}
            </p>

            <button
              ref={okRef}
              type="button"
              className="pro-activated-ok"
              data-testid="pro-account-activated-ok"
              onClick={onClose}
            >
              {t("common.ok")}
            </button>
          </div>

          <div className="pro-activated-waves" aria-hidden="true">
            <svg viewBox="0 0 360 72" preserveAspectRatio="none">
              <path
                className="pro-activated-wave pro-activated-wave--back"
                d="M0 36c36 18 72 18 108 0s72-18 108 0 72 18 108 0 36-9 36-9V72H0Z"
              />
              <path
                className="pro-activated-wave pro-activated-wave--front"
                d="M0 44c40 16 80 16 120 0s80-16 120 0 80 16 120 0V72H0Z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
      <path
        d="m6.5 12.5 3.4 3.4 7.6-7.8"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="m5 5 10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
