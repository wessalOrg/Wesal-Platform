"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/i18n";
import {
  OCCASION_TYPE_KEYS,
  type OccasionTypeKey,
  occasionTypeI18nKey,
} from "@/lib/occasion-types";

type OccasionTypePickerProps = {
  value: string;
  onChange: (value: OccasionTypeKey) => void;
  disabled?: boolean;
  id?: string;
};

function OccasionIcon({ type }: { type: OccasionTypeKey }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "h-5 w-5 shrink-0",
    fill: "none",
    "aria-hidden": true as const,
  };
  const stroke = "currentColor";
  switch (type) {
    case "wedding":
      return (
        <svg {...common}>
          <path
            d="M12 20s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7.5a3.8 3.8 0 0 1 7 3.3C19 15.6 12 20 12 20Z"
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
            className="text-[#c17b7f]"
          />
        </svg>
      );
    case "family":
      return (
        <svg {...common}>
          <path
            d="M8 10h8v7a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-7Z"
            stroke={stroke}
            strokeWidth="1.6"
          />
          <path d="M8 12h8M10 8c0-1.5.9-3 2-3s2 1.5 2 3" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M9 7.5 8 5M15 7.5l1-2.5M12 5.5V3.5" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "social":
      return (
        <svg {...common}>
          <path
            d="M8.5 14.5 6 19l3.2-.9L12 21l1.5-3.2L17 19l-1.2-4.2"
            stroke={stroke}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M14 5.5c2.2 1.4 3.8 3.6 4 6.2" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10.5" cy="9.5" r="2.2" stroke={stroke} strokeWidth="1.5" />
        </svg>
      );
    case "official":
      return (
        <svg {...common}>
          <path
            d="M8 8V6.8A1.8 1.8 0 0 1 9.8 5h4.4A1.8 1.8 0 0 1 16 6.8V8"
            stroke={stroke}
            strokeWidth="1.6"
          />
          <rect x="5" y="8" width="14" height="11" rx="1.5" stroke={stroke} strokeWidth="1.6" />
          <path d="M5 12h14" stroke={stroke} strokeWidth="1.6" />
        </svg>
      );
    case "educational":
      return (
        <svg {...common}>
          <path
            d="M4 10.5 12 6l8 4.5-8 4.5-8-4.5Z"
            stroke={stroke}
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M7 12.5v4.2c0 .4.9 1.8 5 1.8s5-1.4 5-1.8v-4.2" stroke={stroke} strokeWidth="1.6" />
          <path d="M20 10.5V16" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "other":
    default:
      return (
        <svg {...common}>
          <rect x="5" y="6" width="14" height="14" rx="2" stroke={stroke} strokeWidth="1.6" />
          <path d="M5 10h14M9 6V4.5M15 6V4.5" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
          <path
            d="M12 17.2s-2.2-1.3-2.2-2.8a1.2 1.2 0 0 1 2.2-.7 1.2 1.2 0 0 1 2.2.7c0 1.5-2.2 2.8-2.2 2.8Z"
            stroke={stroke}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export default function OccasionTypePicker({
  value,
  onChange,
  disabled,
  id,
}: OccasionTypePickerProps) {
  const t = useT();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = OCCASION_TYPE_KEYS.includes(value as OccasionTypeKey)
    ? (value as OccasionTypeKey)
    : null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative mt-1.5">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="occasion-type-trigger flex w-full items-center gap-2.5 rounded-xl border border-[var(--wesal-border)] bg-[var(--wesal-white)] px-3 py-2.5 text-start text-sm text-[var(--wesal-text)] outline-none transition hover:border-[var(--wesal-maroon)] focus:border-[var(--wesal-maroon)] disabled:opacity-60"
        data-testid="hourly-event-type"
      >
        {selected ? (
          <>
            <span className="text-[var(--wesal-muted)]">
              <OccasionIcon type={selected} />
            </span>
            <span className="min-w-0 flex-1 font-semibold">{t(occasionTypeI18nKey(selected))}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 text-[var(--wesal-muted)]">
            {t("halls.hourly.eventTypePlaceholder")}
          </span>
        )}
        <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-[var(--wesal-muted)]" aria-hidden="true">
          <path
            d="M5 7.5 10 12.5 15 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("halls.hourly.eventType")}
          className="occasion-type-menu relative z-20 mt-1.5 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-white)] py-1 shadow-[0_16px_40px_rgba(40,25,20,0.18)]"
          data-testid="hourly-event-type-list"
        >
          {OCCASION_TYPE_KEYS.map((key, index) => {
            const active = selected === key;
            return (
              <li key={key} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={disabled}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={[
                    "flex w-full items-center gap-3 px-3.5 py-2.5 text-start text-sm transition sm:py-3",
                    active
                      ? "bg-[var(--wesal-pink-soft)] font-bold text-[var(--wesal-maroon)]"
                      : "font-semibold text-[var(--wesal-text)] hover:bg-[var(--wesal-pink-soft)]/70",
                    index > 0 ? "border-t border-[var(--wesal-border)]/70" : "",
                  ].join(" ")}
                  data-testid={`hourly-event-type-${key}`}
                >
                  <span className={active ? "text-[var(--wesal-maroon)]" : "text-[var(--wesal-muted)]"}>
                    <OccasionIcon type={key} />
                  </span>
                  <span className="min-w-0 flex-1">{t(occasionTypeI18nKey(key))}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
