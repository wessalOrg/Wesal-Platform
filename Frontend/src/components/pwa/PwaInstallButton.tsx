"use client";

import { useState } from "react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useT } from "@/i18n";
import IosInstallInstructions from "@/components/pwa/IosInstallInstructions";

function DownloadIcon() {
  return (
    <svg
      width="22"
      height="22"
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
  if (variant !== "compact" && !canPrompt && !isIos) return null;

  const label = t("pwa.installApp");
  const buttonClass =
    variant === "compact"
      ? `inline-flex h-10 w-10 shrink-0 items-center justify-center bg-transparent text-[var(--wesal-maroon)] transition hover:text-[var(--wesal-maroon-dark)] ${className}`.trim()
      : `btn-primary inline-flex w-full items-center justify-center gap-1.5 ${className}`.trim();

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (canPrompt) {
            void promptInstall();
            return;
          }
          if (isIos) setShowIosHelp(true);
        }}
        aria-label={label}
        title={label}
        className={buttonClass}
      >
        <DownloadIcon />
        {variant === "full" ? <span>{label}</span> : null}
      </button>
      {showIosHelp ? (
        <IosInstallInstructions onClose={() => setShowIosHelp(false)} />
      ) : null}
    </>
  );
}
