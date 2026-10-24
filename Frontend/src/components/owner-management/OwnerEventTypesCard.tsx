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
      className="flex h-full flex-col rounded-2xl border border-[rgba(168,98,103,0.14)] bg-white p-3.5 shadow-[0_6px_18px_rgba(90,55,45,0.05)] sm:p-4"
      data-testid="owner-event-types-card"
    >
      <header className="mb-3 flex items-center gap-2">
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f3dfe1] text-[#c17b7f]"
          aria-hidden="true"
        >
          <PartyPopperIcon />
        </span>
        <h2 className="text-[0.88rem] font-extrabold text-[var(--wesal-text)]">
          {t("owner.insights.eventTypesTitle")}
        </h2>
      </header>

      <div className="flex min-h-0 w-full flex-1 items-center gap-3 sm:gap-4">
        <div className="relative aspect-square h-full max-h-[11.5rem] w-auto min-w-[8.5rem] shrink-0 sm:min-w-[9.5rem]">
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

        <ul className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-2.5 sm:gap-3">
          {EVENT_SEGMENTS.map((segment) => (
            <li key={segment.key} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.color }}
                  aria-hidden="true"
                />
                <span className="truncate text-[0.78rem] font-bold text-[var(--wesal-text)]">
                  {t(`owner.insights.eventType.${segment.key}`)}
                </span>
              </span>
              <span className="shrink-0 text-end text-[0.82rem] font-extrabold tabular-nums text-[var(--wesal-text)]">
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

function PartyPopperIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M4.2 19.2 9.8 13.6l.9 3.2 3.2.9-5.6 5.6c-.9.9-2.4.5-2.9-.7L4.2 19.2Z"
        fill="currentColor"
        opacity="0.22"
      />
      <path
        d="M4.2 19.2 9.8 13.6l.9 3.2 3.2.9-5.6 5.6c-.9.9-2.4.5-2.9-.7L4.2 19.2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8.2 15.2 5.6 17.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9.4 16.8 7.2 19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M12.2 10.2c1.1-2.4 3.2-4.1 5.6-4.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13.4 8.4c1.6-1.4 3.6-2.2 5.8-2.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M14.8 5.2 16 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17.6 6.6 19.4 5.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15.8 7.8 17.2 8.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="13.2" cy="4.8" r="0.9" fill="currentColor" />
      <circle cx="19.2" cy="7.4" r="0.9" fill="currentColor" />
      <circle cx="16.6" cy="3.2" r="0.7" fill="currentColor" />
      <path
        d="M18.2 9.4l.7-1.6.7 1.6 1.6.2-1.2 1.1.4 1.6-1.5-.8-1.5.8.4-1.6-1.2-1.1 1.6-.2Z"
        fill="currentColor"
      />
      <path
        d="M12.6 6.2l.45-1 .45 1 .95.12-.72.68.24 1-.9-.48-.9.48.24-1-.72-.68.95-.12Z"
        fill="currentColor"
      />
    </svg>
  );
}
