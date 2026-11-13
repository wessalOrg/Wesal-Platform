"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useProfileAvatarUrl } from "@/hooks/useProfileAvatarUrl";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";

type AccountActivatedModalProps = {
  open: boolean;
  roleLabel: string;
  userName: string;
  profileId?: string;
  onClose: () => void;
};

export default function AccountActivatedModal({
  open,
  roleLabel,
  userName,
  profileId = "",
  onClose,
}: AccountActivatedModalProps) {
  const t = useT();
  const titleId = useId();
  const descId = useId();
  const okRef = useRef<HTMLButtonElement>(null);
  const name = userName.trim() || t("profile.unspecified");
  const avatarUrl = useProfileAvatarUrl([profileId || null]);

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
      className="pro-dash-activated-overlay"
      role="presentation"
      data-testid="pro-account-activated-overlay"
    >
      <button
        type="button"
        className="pro-dash-activated-backdrop"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div className="pro-dash-activated-frame">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="pro-dash-banner pro-dash-banner--approved pro-dash-activated-card"
          data-testid="pro-account-activated-modal"
        >
          <div className="pro-dash-banner-glow" aria-hidden="true" />

          <button
            type="button"
            className="pro-dash-activated-close"
            aria-label={t("common.close")}
            onClick={onClose}
          >
            <CloseIcon />
          </button>

          <div className="pro-dash-banner-main">
            <span
              className={`pro-dash-banner-avatar${avatarUrl ? " pro-dash-banner-avatar--filled" : ""}`}
              aria-hidden="true"
            >
              <span className="pro-dash-banner-icon-ring" />
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="pro-dash-banner-avatar-img" />
              ) : (
                <span className="pro-dash-banner-avatar-placeholder">{initials(name)}</span>
              )}
            </span>

            <div className="pro-dash-banner-copy">
              <h2 id={titleId} className="pro-dash-banner-title">
                {t("pro.dash.activated.hello", { name })}
              </h2>
              <p id={descId} className="pro-dash-activated-role-hint">
                {roleLabel}
              </p>
            </div>
          </div>

          <div className="pro-dash-banner-actions">
            <button
              ref={okRef}
              type="button"
              className="pro-dash-banner-cta"
              data-testid="pro-account-activated-ok"
              onClick={onClose}
            >
              {t("common.ok")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
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
