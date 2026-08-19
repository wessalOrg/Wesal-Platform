"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type Lang = {
  code: "ar" | "en";
  label: string;
  short: string;
  dir: "rtl" | "ltr";
};

const LANGUAGES: Lang[] = [
  { code: "ar", label: "العربية", short: "عربي", dir: "rtl" },
  { code: "en", label: "English", short: "EN", dir: "ltr" },
];

type Props = {
  className?: string;
  compact?: boolean;
};

export function useUiLang(): "ar" | "en" {
  const [lang, setLang] = useState<"ar" | "en">("ar");

  useEffect(() => {
    const read = () => {
      setLang(document.documentElement.lang === "en" ? "en" : "ar");
    };
    read();
    window.addEventListener("wesal-lang-change", read);
    return () => window.removeEventListener("wesal-lang-change", read);
  }, []);

  return lang;
}

export default function LanguageSwitcher({ className = "", compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>(LANGUAGES[0]);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const selectLang = (next: Lang) => {
    document.documentElement.lang = next.code;
    document.documentElement.dir = next.dir;
    setLang(next);
    setOpen(false);
    window.dispatchEvent(new Event("wesal-lang-change"));
  };

  useEffect(() => {
    document.documentElement.lang = lang.code;
    document.documentElement.dir = lang.dir;
  }, [lang]);

  return (
    <div ref={rootRef} className={`lang-switch relative ${className}`}>
      <button
        type="button"
        className={`lang-switch-trigger inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-[var(--wesal-text)] transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--wesal-pink-soft)] hover:text-[var(--wesal-maroon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wesal-maroon)]/30 active:scale-[0.98] ${
          open ? "bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]" : ""
        } ${compact ? "w-full justify-between px-4 py-2.5" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="inline-flex items-center gap-1.5">
          <GlobeIcon />
          <span>{lang.short}</span>
        </span>
        <span
          className={`inline-flex text-[var(--wesal-muted)] transition-transform duration-200 ${
            open ? "rotate-180 text-[var(--wesal-maroon)]" : ""
          }`}
        >
          <ChevronIcon />
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="اختيار اللغة"
          className={`lang-switch-menu absolute z-50 mt-2 min-w-[9.5rem] overflow-hidden rounded-xl border border-[var(--wesal-border)] bg-white/95 p-1.5 shadow-[0_14px_36px_rgba(80,50,40,0.14)] backdrop-blur-md ${
            compact ? "inset-inline-0" : "inset-inline-end-0"
          }`}
        >
          {LANGUAGES.map((item) => {
            const active = item.code === lang.code;
            return (
              <li key={item.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm transition duration-150 ${
                    active
                      ? "bg-[var(--wesal-pink)] font-semibold text-[var(--wesal-maroon)]"
                      : "text-[var(--wesal-text)] hover:bg-[var(--wesal-pink-soft)] hover:text-[var(--wesal-maroon)]"
                  }`}
                  onClick={() => selectLang(item)}
                >
                  <span>{item.label}</span>
                  {active ? <CheckIcon /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3 12h18M12 3c2.5 2.8 3.8 5.8 3.8 9s-1.3 6.2-3.8 9c-2.5-2.8-3.8-5.8-3.8-9S9.5 5.8 12 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l5 5L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
