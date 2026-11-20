"use client";

import { useState } from "react";
import { useT } from "@/i18n";

async function copyNumber(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    // Keep copying available in browsers without Clipboard API access.
    const previousFocus = document.activeElement;
    const field = document.createElement("textarea");
    field.value = value;
    field.readOnly = true;
    field.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(field);
    try {
      field.select();
      if (!document.execCommand("copy")) throw new Error("Copy failed");
    } finally {
      field.remove();
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    }
  }
}

export default function ProfilePhoneCopyButton({ phone }: { phone: string }) {
  const t = useT();
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  return (
    <>
      <button type="button" className="ppp-phone-copy" data-testid="professional-profile-phone-copy"
        onClick={async () => {
          try {
            await copyNumber(phone.trim());
            setStatus("copied");
          } catch {
            setStatus("error");
          }
        }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <rect x="8" y="8" width="12" height="13" rx="2" />
          <path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
        </svg>
        <span aria-live="polite">{t(status === "copied" ? "halls.details.phoneCopied" : "halls.details.copyPhone")}</span>
      </button>
      {status === "error" ? <span className="ppp-phone-copy-error" role="alert">{t("portfolio.phoneCopyFailed")}</span> : null}
    </>
  );
}
