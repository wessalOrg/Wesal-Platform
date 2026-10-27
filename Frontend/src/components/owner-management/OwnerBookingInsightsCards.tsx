"use client";

import { useT } from "@/i18n";
import type { OwnerVisitorStats, OwnerVisitorStatsLoadStatus } from "@/types/owner-visitor-stats";

const HOUR_COLORS: Record<string, string> = { evening: "#c17b7f", afternoon: "#8fbf8f", morning: "#f0d7a0", other: "#d7dde3" };

export default function OwnerBookingInsightsCards({ status, stats, onRetry }: { status: OwnerVisitorStatsLoadStatus; stats: OwnerVisitorStats | null; onRetry: () => void }) {
  const t = useT();
  const weekdays = [...(stats?.bookingsByWeekday ?? [])].filter((day) => day.count > 0).sort((a, b) => b.count - a.count);
  const hourSegments = (stats?.bookedHoursByPeriod ?? []).filter((item) => item.count > 0).map((item) => ({ ...item, color: HOUR_COLORS[item.key] ?? HOUR_COLORS.other }));

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      data-testid="owner-booking-insights"
    >
      {status === "error" ? <div className="col-span-full flex items-center justify-between gap-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800" role="alert"><span>{t("owner.insights.loadError")}</span><button className="btn-outline" onClick={onRetry}>{t("common.retry")}</button></div> : null}
      <section
        className="rounded-2xl border border-[rgba(168,98,103,0.14)] bg-white p-3 shadow-[0_6px_18px_rgba(90,55,45,0.05)] sm:p-3.5"
        data-testid="owner-booking-insights-weekdays"
      >
        <header className="mb-2.5 flex items-center gap-2">
          <span className="inline-flex shrink-0 text-[var(--wesal-maroon)]" aria-hidden="true">
            <CalendarIcon />
          </span>
          <h2 className="text-[0.82rem] font-extrabold text-[var(--wesal-text)]">
            {t("owner.insights.topWeekdaysTitle")}
          </h2>
        </header>

        <ul className="space-y-2">
          {status === "loading" || status === "idle" ? <li className="h-20 animate-pulse rounded-xl bg-[#f3eeec]" /> : weekdays.length === 0 ? <li className="text-sm text-[var(--wesal-muted)]">{t("owner.insights.noBookingData")}</li> : weekdays.map((day) => (
            <li
              key={day.key}
              className="grid grid-cols-[3.75rem_minmax(0,1fr)_2.2rem] items-center gap-2"
            >
              <span className="truncate text-[0.72rem] font-bold text-[var(--wesal-text)]">
                {t(`owner.insights.weekday.${day.key}`)}
              </span>
              <span className="h-2 overflow-hidden rounded-full bg-[#ece8e6]">
                <span
                  className="block h-full rounded-full bg-[#c17b7f]"
                  style={{ width: `${day.percentage}%` }}
                />
              </span>
              <span className="text-end text-[0.72rem] font-extrabold tabular-nums text-[var(--wesal-text)]">
                {day.percentage}%
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section
        className="rounded-2xl border border-[rgba(168,98,103,0.14)] bg-white p-3 shadow-[0_6px_18px_rgba(90,55,45,0.05)] sm:p-3.5"
        data-testid="owner-booking-insights-hours"
      >
        <header className="mb-2.5 flex items-center gap-2">
          <span
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]"
            aria-hidden="true"
          >
            <ClockIcon />
          </span>
          <h2 className="text-[0.82rem] font-extrabold text-[var(--wesal-text)]">
            {t("owner.insights.hoursDistributionTitle")}
          </h2>
        </header>

        <div className="flex w-full items-center justify-between gap-3 sm:gap-4">
          <div className="relative h-[7.5rem] w-[7.5rem] shrink-0 sm:h-[8.25rem] sm:w-[8.25rem]">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="60" cy="60" r="42" fill="none" stroke="var(--wesal-border)" strokeWidth="16" />
              {donutArcs(hourSegments.map((item) => ({ key: item.key, percent: item.percentage, color: item.color }))).map((arc) => (
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
                {status === "ready" ? stats?.totalBookedHoursThisMonth ?? 0 : "—"}
              </p>
              <p className="mt-1 text-[0.75rem] font-bold text-[var(--wesal-muted)]">
                {t("owner.insights.hoursUnit")}
              </p>
            </div>
          </div>

          <ul className="min-w-0 flex-1 space-y-3">
            {status === "loading" || status === "idle" ? <li className="h-16 animate-pulse rounded-xl bg-[#f3eeec]" /> : hourSegments.length === 0 ? <li className="text-sm text-[var(--wesal-muted)]">{t("owner.insights.noBookingData")}</li> : hourSegments.map((segment) => (
              <li key={segment.key} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: segment.color }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-[0.8rem] font-bold text-[var(--wesal-text)]">
                    {t(`owner.insights.hourBand.${segment.key}`)}
                  </span>
                </span>
                <span className="shrink-0 text-[0.85rem] font-extrabold tabular-nums text-[var(--wesal-text)]">
                  {segment.percentage}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
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

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
