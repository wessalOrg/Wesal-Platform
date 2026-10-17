"use client";

import { useState } from "react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useT } from "@/i18n";
import IosInstallInstructions from "@/components/pwa/IosInstallInstructions";

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  /** Visual density — navbar uses compact, banner/modal use full. */
  variant?: "compact" | "full";
  className?: string;
};

/**
 * "تثبيت التطبيق" button.
 * - Chromium/Android: fires the captured native `beforeinstallprompt`.
 * - iOS/Safari: opens manual "Share → Add to Home Screen" instructions.
 * - Renders nothing when installed or when installation is unavailable.
 */
export default function PwaInstallButton({
  variant = "compact",
  className = "",
}: Props) {
  const t = useT();
  const { canPrompt, isInstalled, isIos, promptInstall } = usePwaInstall();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (isInstalled) return null;

  if (canPrompt) {
    return (
      <button
        type="button"
        onClick={() => void promptInstall()}
        aria-label={t("pwa.installApp")}
        title={t("pwa.installApp")}
        className={
          variant === "compact"
            ? `inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--wesal-maroon)] bg-white px-3 text-xs font-bold text-[var(--wesal-maroon)] transition hover:bg-[var(--wesal-maroon)] hover:text-white ${className}`.trim()
            : `btn-primary w-full ${className}`.trim()
        }
      >
        <DownloadIcon />
        <span>{t("pwa.installApp")}</span>
      </button>
    );
  }

  if (isIos) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIosHelp(true)}
          aria-label={t("pwa.installApp")}
          title={t("pwa.installApp")}
          className={
            variant === "compact"
              ? `inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--wesal-maroon)] bg-white px-3 text-xs font-bold text-[var(--wesal-maroon)] transition hover:bg-[var(--wesal-maroon)] hover:text-white ${className}`.trim()
              : `btn-primary w-full ${className}`.trim()
          }
        >
          <DownloadIcon />
          <span>{t("pwa.installApp")}</span>
        </button>
        {showIosHelp ? (
          <IosInstallInstructions onClose={() => setShowIosHelp(false)} />
        ) : null}
      </>
    );
  }

  return null;
}
