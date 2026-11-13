"use client";

import { useEffect, useId, useRef, useState } from "react";
import MabroukFigure from "@/components/brand/MabroukFigure";
import { useT } from "@/i18n";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/body-scroll-lock";
import {
  LOCK_DURATION_PRESETS,
  MODERATION_REASON_MAX,
  type LockDurationPresetId,
} from "@/types/admin-moderation";

export type RestrictionUserPreview = {
  userId: string;
  displayName: string;
  roleLabel: string;
  avatarInitial?: string;
};

type RestrictionModalProps = {
  open: boolean;
  busy?: boolean;
  errorKey?: string | null;
  user: RestrictionUserPreview | null;
  onClose: () => void;
  onConfirm: (payload: { durationHours: number; reason: string }) => void;
};

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function RestrictionModal({
  open,
  busy = false,
  errorKey = null,
  user,
  onClose,
  onConfirm,
}: RestrictionModalProps) {
  const t = useT();
  const titleId = useId();
  const descId = useId();
  const reasonId = useId();
  const customId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [preset, setPreset] = useState<LockDurationPresetId>("7d");
  const [customHours, setCustomHours] = useState("24");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setPreset("7d");
    setCustomHours("24");
    setReason("");
    lockBodyScroll();

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

  if (!open || !user) return null;

  const resolvedHours =
    preset === "custom"
      ? Number(customHours)
      : LOCK_DURATION_PRESETS.find((item) => item.id === preset)?.hours ?? 168;
  const hoursValid =
    Number.isFinite(resolvedHours) &&
    resolvedHours >= 1 &&
    resolvedHours <= 720;

  const resolvedError =
    errorKey &&
    (errorKey.startsWith("admin.") ||
      errorKey.startsWith("errors.") ||
      errorKey.startsWith("common."))
      ? t(errorKey)
      : errorKey;

  const initial = (user.avatarInitial || user.displayName.charAt(0) || "?").toUpperCase();

  return (
    <div className="fixed inset-0 z-[140]" role="presentation" data-testid="lock-account-modal">
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
          className="relative z-10 max-h-[92vh] w-full max-w-[30rem] overflow-y-auto rounded-t-[1.25rem] border border-[var(--wesal-border)] bg-white px-5 pb-5 pt-4 shadow-[0_1.5rem_3.75rem_rgba(60,35,30,0.22)] sm:rounded-[1.25rem] sm:px-6 sm:pb-6 sm:pt-5"
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
            {t("admin.moderation.restrict.title")}
          </h2>
          <p
            id={descId}
            className="mt-2 text-center text-sm leading-6 text-[var(--wesal-muted)]"
          >
            {t("admin.moderation.restrict.body")}
          </p>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)]/40 px-3 py-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-sm font-bold text-white">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--wesal-text)]">
                {user.displayName}
              </p>
              <p className="text-xs text-[var(--wesal-muted)]">{user.roleLabel}</p>
            </div>
          </div>

          <p className="mt-4 text-sm font-semibold text-[var(--wesal-text)]">
            {t("admin.moderation.restrict.periodLabel")}
          </p>
          <div
            className="mt-2 flex flex-wrap gap-2"
            role="group"
            aria-label={t("admin.moderation.restrict.periodLabel")}
          >
            {LOCK_DURATION_PRESETS.map((item) => {
              const selected = preset === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  className={`inline-flex min-h-11 items-center rounded-full px-3 py-1.5 text-xs font-bold transition ${
                    selected
                      ? "bg-[var(--wesal-maroon)] text-white"
                      : "bg-white text-[var(--wesal-muted)] ring-1 ring-[var(--wesal-border)] hover:text-[var(--wesal-maroon)]"
                  }`}
                  aria-pressed={selected}
                  onClick={() => setPreset(item.id)}
                >
                  {t(`admin.moderation.period.${item.id}`)}
                </button>
              );
            })}
            <button
              type="button"
              disabled={busy}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
                preset === "custom"
                  ? "bg-[var(--wesal-maroon)] text-white"
                  : "bg-white text-[var(--wesal-muted)] ring-1 ring-[var(--wesal-border)]"
              }`}
              aria-pressed={preset === "custom"}
              onClick={() => setPreset("custom")}
            >
              <CalendarIcon />
              {t("admin.moderation.period.custom")}
            </button>
          </div>

          {preset === "custom" ? (
            <div className="mt-3">
              <label
                htmlFor={customId}
                className="text-xs font-semibold text-[var(--wesal-muted)]"
              >
                {t("admin.moderation.restrict.customHours")}
              </label>
              <input
                id={customId}
                type="number"
                min={1}
                max={720}
                value={customHours}
                disabled={busy}
                className="mt-1 min-h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2 text-sm font-semibold text-[var(--wesal-text)] outline-none focus:border-[var(--wesal-maroon)]"
                onChange={(event) => setCustomHours(event.target.value)}
                data-testid="restriction-custom-hours"
              />
              {!hoursValid ? (
                <p className="mt-1 text-xs text-[#b42318]" role="alert">
                  {t("admin.moderation.restrict.hoursInvalid")}
                </p>
              ) : null}
            </div>
          ) : null}

          <label
            htmlFor={reasonId}
            className="mt-4 block text-sm font-semibold text-[var(--wesal-text)]"
          >
            {t("admin.moderation.restrict.reasonLabel")}
          </label>
          <div className="relative mt-1.5">
            <textarea
              id={reasonId}
              rows={3}
              maxLength={MODERATION_REASON_MAX}
              value={reason}
              disabled={busy}
              placeholder={t("admin.moderation.restrict.reasonPlaceholder")}
              className="w-full resize-none rounded-xl border border-[var(--wesal-border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--wesal-maroon)] disabled:opacity-60"
              onChange={(event) => setReason(event.target.value)}
              data-testid="restriction-reason"
            />
            <p className="pointer-events-none absolute bottom-2 start-3 text-[0.7rem] text-[var(--wesal-muted)]">
              {reason.length}/{MODERATION_REASON_MAX}
            </p>
          </div>

          <div className="mt-3 flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--wesal-maroon)_10%,white)] px-3 py-2.5 text-xs leading-5 text-[var(--wesal-maroon-dark)]">
            <span
              className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-[0.55rem] font-bold text-white"
              aria-hidden="true"
            >
              i
            </span>
            <p>{t("admin.moderation.restrict.notifyHint")}</p>
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
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--wesal-maroon)] px-4 text-sm font-bold text-white transition hover:bg-[var(--wesal-maroon-dark)] disabled:opacity-60"
              disabled={busy || !hoursValid}
              data-testid="restriction-confirm"
              onClick={() => {
                if (!hoursValid || busy) return;
                onConfirm({
                  durationHours: Math.round(resolvedHours),
                  reason: reason.trim(),
                });
              }}
            >
              <LockIcon className="h-4 w-4" />
              {busy
                ? t("admin.moderation.restrict.busy")
                : t("admin.moderation.restrict.confirm")}
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

function LockIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 10V8a4 4 0 0 1 8 0v2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
