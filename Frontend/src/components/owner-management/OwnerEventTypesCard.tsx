"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import {
  occasionTypeBreakdown,
  getOccasionTypeCounts,
  type OccasionTypeCounts,
} from "@/lib/occasion-type-stats";
import { OCCASION_TYPE_COLORS, occasionTypeI18nKey } from "@/lib/occasion-types";

export default function OwnerEventTypesCard() {
  const t = useT();
  const [counts, setCounts] = useState<OccasionTypeCounts>(() => getOccasionTypeCounts());

  useEffect(() => {
    const refresh = () => setCounts(getOccasionTypeCounts());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("wesal:occasion-type-stats", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("wesal:occasion-type-stats", refresh);
    };
  }, []);

  const { total, segments } = occasionTypeBreakdown(counts);
  // Chart arcs: only slices with bookings (or equal placeholder slices when empty).
  const chartSegments =
    total > 0
      ? segments
          .filter((s) => s.count > 0)
          .map((s) => ({
            key: s.key,
            percent: s.percent,
            color: OCCASION_TYPE_COLORS[s.key],
          }))
      : segments.map((s) => ({
          key: s.key,
          percent: Math.round(100 / segments.length),
          color: OCCASION_TYPE_COLORS[s.key],
        }));

  return (
    <section
      className="owner-event-types-card flex h-full flex-col rounded-2xl border border-[rgba(168,98,103,0.14)] bg-white p-3 shadow-[0_6px_18px_rgba(90,55,45,0.05)] sm:p-3.5"
      data-testid="owner-event-types-card"
    >
      <header className="mb-3 flex items-center gap-2">
        <img
          src="/icons/party-popper.png"
          alt=""
          width={22}
          height={22}
          className="h-[1.35rem] w-[1.35rem] shrink-0 rounded-md object-cover"
          aria-hidden="true"
        />
        <h2 className="text-[0.88rem] font-extrabold text-[var(--wesal-text)]">
          {t("owner.insights.eventTypesTitle")}
        </h2>
      </header>

      <div className="flex min-h-0 w-full flex-1 items-center justify-start gap-3 sm:gap-4">
        <div className="relative aspect-square h-[9.5rem] w-[9.5rem] shrink-0 sm:h-[10.5rem] sm:w-[10.5rem]">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r="42" fill="none" stroke="var(--wesal-border)" strokeWidth="16" />
            {donutArcs(chartSegments).map((arc) => (
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
                style={{ stroke: arc.color, opacity: total === 0 ? 0.35 : 1 }}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-3xl font-extrabold leading-none text-[var(--wesal-text)]">{total}</p>
            <p className="mt-1 text-[0.75rem] font-bold text-[var(--wesal-muted)]">
              {t("owner.insights.bookingsUnit")}
            </p>
          </div>
        </div>

        <ul className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 sm:gap-2">
          {segments.map((segment) => (
            <li
              key={segment.key}
              className="flex w-full max-w-[15rem] items-center justify-between gap-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: OCCASION_TYPE_COLORS[segment.key],
                    opacity: total > 0 && segment.count === 0 ? 0.4 : 1,
                  }}
                  aria-hidden="true"
                />
                <span
                  className={`truncate text-[0.78rem] font-bold ${
                    total > 0 && segment.count === 0
                      ? "text-[var(--wesal-muted)]"
                      : "text-[var(--wesal-text)]"
                  }`}
                >
                  {t(occasionTypeI18nKey(segment.key))}
                </span>
              </span>
              <span
                className={`shrink-0 text-[0.82rem] font-extrabold tabular-nums ${
                  total > 0 && segment.count === 0
                    ? "text-[var(--wesal-muted)]"
                    : "text-[var(--wesal-text)]"
                }`}
              >
                {total > 0 ? `${segment.percent}%` : "—"}
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
