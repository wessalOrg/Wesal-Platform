"use client";

import { useLanguage, useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";

export { useUiLang };

type Props = {
  className?: string;
  compact?: boolean;
};

/**
 * Top-bar language toggle: Arabic (default) ↔ English.
 * Persists locally and syncs with GET/PUT /language when authenticated.
 */
export default function LanguageSwitcher({ className = "", compact = false }: Props) {
  const { lang, toggleLanguage, status } = useLanguage();
  const t = useT();
  const nextLabel = lang === "ar" ? t("lang.shortEn") : t("lang.shortAr");
  const ariaLabel = lang === "ar" ? t("lang.switchToEn") : t("lang.switchToAr");

  return (
    <button
      type="button"
      className={`lang-switch-trigger inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-[#8f6f2e] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--wesal-pink-soft)] hover:text-[var(--wesal-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wesal-gold)]/35 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 ${
        compact ? "w-full justify-between px-4 py-2.5" : ""
      } ${className}`}
      aria-label={ariaLabel}
      data-testid="language-toggle"
      data-lang={lang}
      disabled={status === "loading"}
      onClick={() => {
        void toggleLanguage();
      }}
    >
      <span className="inline-flex items-center gap-1.5">
        <ChatIcon />
        <span className="font-semibold">{nextLabel}</span>
      </span>
      {compact ? (
        <span className="text-xs text-[var(--wesal-muted)]">
          {lang === "ar" ? t("lang.currentAr") : t("lang.currentEn")}
        </span>
      ) : null}
    </button>
  );
}

/** Overlapping chat bubbles — language switch without the translate glyph. */
function ChatIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5.2 4.8h9.2c1.3 0 2.3 1 2.3 2.3v4.6c0 1.3-1 2.3-2.3 2.3H10.4L7.2 16.4v-2.4H5.2c-1.3 0-2.3-1-2.3-2.3V7.1c0-1.3 1-2.3 2.3-2.3Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="M10.8 10.6h8c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2h-1.6l-2.6 2v-2H10.8c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
    </svg>
  );
}
