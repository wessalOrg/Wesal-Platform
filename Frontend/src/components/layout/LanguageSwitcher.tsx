"use client";

import { useLanguage, useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";

export { useUiLang };

type Props = {
  className?: string;
  compact?: boolean;
  /** Circular icon control (dashboard topbars). */
  iconOnly?: boolean;
};

/**
 * Top-bar language toggle: Arabic (default) ↔ English.
 * Persists locally and syncs with GET/PUT /language when authenticated.
 */
export default function LanguageSwitcher({
  className = "",
  compact = false,
  iconOnly = false,
}: Props) {
  const { lang, toggleLanguage, status } = useLanguage();
  const t = useT();
  const nextLabel = lang === "ar" ? t("lang.shortEn") : t("lang.shortAr");
  const ariaLabel = lang === "ar" ? t("lang.switchToEn") : t("lang.switchToAr");

  return (
    <button
      type="button"
      className={`lang-switch-trigger inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-[#8f6f2e] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--wesal-pink-soft)] hover:text-[var(--wesal-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wesal-gold)]/35 active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 ${
        compact ? "w-full justify-between px-4 py-2.5" : ""
      } ${iconOnly ? "lang-switch-trigger--icon" : ""} ${className}`}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-testid="language-toggle"
      data-lang={lang}
      disabled={status === "loading"}
      onClick={() => {
        void toggleLanguage();
      }}
    >
      <span className="inline-flex items-center gap-1.5">
        <GlobeIcon />
        {iconOnly ? null : <span className="font-semibold">{nextLabel}</span>}
      </span>
      {compact && !iconOnly ? (
        <span className="text-xs text-[var(--wesal-muted)]">
          {lang === "ar" ? t("lang.currentAr") : t("lang.currentEn")}
        </span>
      ) : null}
    </button>
  );
}

/** Globe — standard language switcher icon. */
function GlobeIcon() {
  return (
    <svg
      className="lang-switch-icon"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.55" />
      <path
        d="M3.5 12h17M12 3.5c2.4 2.6 3.6 5.5 3.6 8.5s-1.2 5.9-3.6 8.5M12 3.5C9.6 6.1 8.4 9 8.4 12s1.2 5.9 3.6 8.5"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
      <path
        d="M5.2 7.2h13.6M5.2 16.8h13.6"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
      />
    </svg>
  );
}
