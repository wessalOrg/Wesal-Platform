"use client";

import { useT } from "@/i18n";

/** Frontend-only demo breakdown of booking event types. Brand = --wesal-maroon. */
const EVENT_SEGMENTS = [
  { key: "wedding" as const, percent: 45, color: "#c17b7f" },
  { key: "engagement" as const, percent: 20, color: "#a8d4e8" },
  { key: "family" as const, percent: 15, color: "#e8c9b0" },
  { key: "birthday" as const, percent: 10, color: "#b8a0c8" },
  { key: "other" as const, percent: 10, color: "#9aa7b5" },
];

const TOTAL_BOOKINGS = 64;

export default function OwnerEventTypesCard() {
  const t = useT();

  return (
    <section
      className="rounded-2xl border border-[rgba(168,98,103,0.14)] bg-white p-4 shadow-[0_6px_18px_rgba(90,55,45,0.05)] sm:p-5"
      data-testid="owner-event-types-card"
    >
      <header className="mb-4 flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]"
          aria-hidden="true"
        >
          <UsersIcon />
        </span>
        <h2 className="text-[0.9rem] font-extrabold text-[var(--wesal-text)]">
          {t("owner.insights.eventTypesTitle")}
        </h2>
      </header>

      <div className="flex w-full items-center justify-between gap-4 sm:gap-6">
        <div className="relative h-[9.5rem] w-[9.5rem] shrink-0 sm:h-[10.5rem] sm:w-[10.5rem]">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r="42" fill="none" stroke="#f3eeec" strokeWidth="16" />
            {donutArcs(EVENT_SEGMENTS).map((arc) => (
              <circle
                key={arc.key}
                cx="60"
                cy="60"
                r="42"
                fill="none"
                strokeWidth="16"
                strokeDasharray={`${arc.length} ${arc.gap}`}
                strokeDashoffset={arc.offset}
                strokeLinecap="butt"
                style={{ stroke: arc.color }}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-extrabold leading-none text-[var(--wesal-text)]">
              {TOTAL_BOOKINGS}
            </p>
            <p className="mt-1 text-[0.75rem] font-bold text-[var(--wesal-muted)]">
              {t("owner.insights.bookingsUnit")}
            </p>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-2.5">
          {EVENT_SEGMENTS.map((segment) => (
            <li key={segment.key} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-[0.8rem] font-bold text-[var(--wesal-text)]">
                  {t(`owner.insights.eventType.${segment.key}`)}
                </span>
              </span>
              <span className="shrink-0 text-[0.85rem] font-extrabold tabular-nums text-[var(--wesal-text)]">
                {segment.percent}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function donutArcs(
  segments: Array<{ key: string; percent: number; color: string }>,
): Array<{ key: string; color: string; length: number; gap: number; offset: number }> {
  const circumference = 2 * Math.PI * 42;
  let cursor = 0;
  return segments.map((segment) => {
    const length = (segment.percent / 100) * circumference;
    const offset = -cursor;
    cursor += length;
    return {
      key: segment.key,
      color: segment.color,
      length,
      gap: circumference - length,
      offset,
    };
  });
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16.5" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.8 18.5c.7-2.6 2.9-4 5.2-4s4.5 1.4 5.2 4M14 14.8c1.7-.2 3.4.7 4.2 2.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
