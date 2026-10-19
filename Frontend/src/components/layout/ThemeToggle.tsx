"use client";

import { useT } from "@/i18n";
import { toggleDocumentTheme } from "@/lib/theme";

type ThemeToggleProps = {
  className?: string;
};

/** Moon in light mode, sun in dark mode. The icon swap is CSS-only. */
export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const t = useT();

  return (
    <button
      type="button"
      className={`theme-toggle lang-switch-trigger inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl px-2.5 py-2 text-[#8f6f2e] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--wesal-pink-soft)] hover:text-[var(--wesal-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wesal-gold)]/35 active:scale-[0.98] ${className}`}
      aria-label={t("theme.toggle")}
      title={t("theme.toggle")}
      data-testid="theme-toggle"
      onClick={() => toggleDocumentTheme()}
    >
      <MoonIcon />
      <SunIcon />
    </button>
  );
}

function MoonIcon() {
  return (
    <svg
      className="theme-toggle-icon theme-toggle-moon"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16.5 13.2A6.6 6.6 0 0 1 10.6 4.2 7.2 7.2 0 1 0 19.8 13.4a6.7 6.7 0 0 1-3.3-.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      className="theme-toggle-icon theme-toggle-sun"
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3.2v1.8M12 19v1.8M4.9 4.9l1.3 1.3M17.8 17.8l1.3 1.3M3.2 12h1.8M19 12h1.8M4.9 19.1l1.3-1.3M17.8 6.2l1.3-1.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
