"use client";

import { useEffect, useState } from "react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useT } from "@/i18n";
import PwaInstallButton from "@/components/pwa/PwaInstallButton";
import IosInstallInstructions from "@/components/pwa/IosInstallInstructions";

const DISMISS_KEY = "wesal-pwa-banner-dismissed-at";
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // re-eligible after 30 days

function wasRecentlyDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

/**
 * Gentle one-time install banner (bottom, RTL).
 * - Shows only when installation is actually available (native prompt) or iOS.
 * - Never shows when installed; snoozes 30 days after dismissal/install.
 */
export default function PwaInstallBanner() {
  const t = useT();
  const { canPrompt, isInstalled, isIos } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isInstalled) return;
    if (!canPrompt && !isIos) return;
    if (wasRecentlyDismissed()) return;
    const timer = window.setTimeout(() => setVisible(true), 4000);
    return () => window.clearTimeout(timer);
  }, [canPrompt, isInstalled, isIos]);

  if (!visible || isInstalled) return null;
  if (!canPrompt && !isIos) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode — banner simply returns next visit */
    }
  };

  const handleIosTap = () => setShowIosHelp(true);

  return (
    <>
      <div
        role="dialog"
        aria-label={t("pwa.bannerTitle")}
        dir="rtl"
        className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4"
      >
        <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-[var(--wesal-border)] bg-white/95 px-4 py-3 shadow-[0_18px_40px_rgba(90,55,45,0.18)] backdrop-blur">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--wesal-maroon)] text-lg font-extrabold text-white"
          >
            و
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-extrabold text-[var(--wesal-text)]">
              {t("pwa.bannerTitle")}
            </p>
            <p className="truncate text-[11px] text-[var(--wesal-muted)]">
              {t("pwa.bannerBody")}
            </p>
          </div>
          {isIos && !canPrompt ? (
            <button
              type="button"
              onClick={handleIosTap}
              className="btn-primary min-h-10 shrink-0 px-4 text-xs"
            >
              {t("pwa.installApp")}
            </button>
          ) : (
            <PwaInstallButton variant="full" className="min-h-10 max-w-28 text-xs" />
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("common.close")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--wesal-muted)] hover:bg-[var(--wesal-pink)]"
          >
            ✕
          </button>
        </div>
      </div>
      {showIosHelp ? (
        <IosInstallInstructions onClose={() => setShowIosHelp(false)} />
      ) : null}
    </>
  );
}
