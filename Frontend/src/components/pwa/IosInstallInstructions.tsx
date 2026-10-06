"use client";

import { useEffect } from "react";
import { useT } from "@/i18n";

type Props = {
  onClose: () => void;
};

/**
 * iOS/Safari has no `beforeinstallprompt` — walk the user through
 * Share → Add to Home Screen. RTL, dismissible, no side effects.
 */
export default function IosInstallInstructions({ onClose }: Props) {
  const t = useT();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("pwa.iosTitle")}
      dir="rtl"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-[0_24px_60px_rgba(60,30,25,0.3)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-extrabold text-[var(--wesal-maroon)]">
            {t("pwa.iosTitle")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--wesal-border)] text-[var(--wesal-muted)]"
          >
            ✕
          </button>
        </div>
        <ol className="mt-3 space-y-2.5 text-xs leading-6 text-[var(--wesal-text)]">
          <li className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink)] text-[10px] font-extrabold text-[var(--wesal-maroon)]"
            >
              1
            </span>
            <span>{t("pwa.iosStep1")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink)] text-[10px] font-extrabold text-[var(--wesal-maroon)]"
            >
              2
            </span>
            <span>{t("pwa.iosStep2")}</span>
          </li>
          <li className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink)] text-[10px] font-extrabold text-[var(--wesal-maroon)]"
            >
              3
            </span>
            <span>{t("pwa.iosStep3")}</span>
          </li>
        </ol>
        <button
          type="button"
          onClick={onClose}
          className="btn-primary mt-4 w-full"
        >
          {t("common.ok")}
        </button>
      </div>
    </div>
  );
}
