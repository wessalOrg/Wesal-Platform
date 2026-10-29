"use client";

import type { ReactNode } from "react";
import { useT } from "@/i18n";
import {
  formatConversionRate,
  formatStatCount,
  percentChange,
} from "@/lib/owner-visitor-stats";
import type {
  OwnerVisitorStats,
  OwnerVisitorStatsLoadStatus,
} from "@/types/owner-visitor-stats";

type OwnerVisitorStatsCardProps = {
  status: OwnerVisitorStatsLoadStatus;
  stats: OwnerVisitorStats | null;
  onRetry?: () => void;
  /** Optional subtitle when a single hall is selected in the insights filter. */
  scopeLabel?: string;
};

export default function OwnerVisitorStatsCard({
  status,
  stats,
  onRetry,
  scopeLabel,
}: OwnerVisitorStatsCardProps) {
  const t = useT();
  /** Stats digits stay Western/English even when UI is Arabic. */
  const locale = "en-GB";

  const visitsChange =
    stats != null ? percentChange(stats.visitsThisMonth, stats.visitsPreviousMonth) : null;
  const favoritesChange =
    stats != null
      ? percentChange(stats.favoritesThisMonth, stats.favoritesPreviousMonth)
      : null;
  const bookingsChange =
    stats != null
      ? percentChange(stats.bookingRequestsThisMonth, stats.bookingRequestsPreviousMonth)
      : null;
  const conversionDelta =
    stats != null
      ? Math.round(
          (stats.conversionRateThisMonth - stats.conversionRatePreviousMonth) * 10,
        ) / 10
      : null;
  const barScale =
    stats != null
      ? Math.max(
          stats.visitsThisMonth,
          stats.favoritesThisMonth,
          stats.bookingRequestsThisMonth,
          1,
        )
      : 1;

  return (
    <section
      className="h-full overflow-visible rounded-2xl border border-[rgba(168,98,103,0.12)] bg-[#fdf8f8] p-3 shadow-[0_6px_18px_rgba(90,55,45,0.05)] sm:overflow-hidden sm:p-3.5"
      aria-labelledby="owner-visitor-stats-heading"
      data-testid="owner-visitor-stats"
      data-load-status={status}
      data-scope={scopeLabel ? "hall" : "all-halls"}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f3dfe1] text-[#c17b7f]"
            aria-hidden="true"
          >
            <ChartIcon />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="owner-visitor-stats-heading"
              className="wesal-text-bold text-[0.95rem] font-extrabold leading-snug text-[#c17b7f] sm:text-[1.02rem]"
            >
              {t("owner.visitorStats.title")}
            </h2>
            <p className="mt-0.5 text-[0.68rem] font-medium leading-snug text-[var(--wesal-muted)]">
              {scopeLabel ?? t("owner.visitorStats.subtitle")}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[rgba(168,98,103,0.2)] bg-white px-2 py-1 text-[0.6rem] font-bold text-[#a86267]">
          <CalendarIcon />
          {t("owner.visitorStats.periodThisMonth")}
          <ChevronIcon />
        </span>
      </header>

      {status === "loading" || status === "idle" ? (
        <div className="mt-2.5 space-y-1.5" aria-busy="true">
          <div className="h-11 animate-pulse rounded-xl bg-[#f3dfe1]" />
          <div className="h-11 animate-pulse rounded-xl bg-[#f3dfe1]" />
          <div className="h-11 animate-pulse rounded-xl bg-[#f3dfe1]" />
          <div className="h-10 animate-pulse rounded-xl bg-[#f3dfe1]" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="mt-2.5 rounded-xl bg-[rgba(180,35,24,0.06)] px-3 py-2" role="alert">
          <p className="text-[0.75rem] font-semibold text-[#b42318]">
            {t("owner.visitorStats.loadError")}
          </p>
          {onRetry ? (
            <button type="button" className="btn-outline mt-2 text-xs" onClick={onRetry}>
              {t("common.retry")}
            </button>
          ) : null}
        </div>
      ) : null}

      {status === "ready" && stats ? (
        <div className="mt-2.5 space-y-1.5">
          <MetricRow
            icon={<EyeIcon />}
            iconClass="bg-[#f3dfe1] text-[#c17b7f]"
            title={t("owner.visitorStats.visitsTitle")}
            subtitle={t("owner.visitorStats.visitsSubtitle")}
            value={t("owner.visitorStats.visitsValue", {
              count: formatStatCount(stats.visitsThisMonth, locale),
            })}
            change={visitsChange}
            barPercent={barFill(stats.visitsThisMonth, barScale)}
            barClass="bg-[#c17b7f]"
            vsHint={t("owner.visitorStats.vsPreviousHint")}
          />
          <MetricRow
            icon={<HeartIcon />}
            iconClass="bg-[rgba(196,160,92,0.18)] text-[#9a7a35]"
            title={t("owner.visitorStats.favoritesTitle")}
            subtitle={t("owner.visitorStats.favoritesSubtitle")}
            value={t("owner.visitorStats.favoritesValue", {
              count: formatStatCount(stats.favoritesThisMonth, locale),
            })}
            change={favoritesChange}
            barPercent={barFill(stats.favoritesThisMonth, barScale)}
            barClass="bg-[#c4a05c]"
            vsHint={t("owner.visitorStats.vsPreviousHint")}
          />
          <MetricRow
            icon={<DocIcon />}
            iconClass="bg-[#f3dfe1] text-[#a86267]"
            title={t("owner.visitorStats.bookingsTitle")}
            subtitle={t("owner.visitorStats.bookingsSubtitle")}
            value={t("owner.visitorStats.bookingsValue", {
              count: formatStatCount(stats.bookingRequestsThisMonth, locale),
            })}
            change={bookingsChange}
            barPercent={barFill(stats.bookingRequestsThisMonth, barScale)}
            barClass="bg-[#d49a9d]"
            vsHint={t("owner.visitorStats.vsPreviousHint")}
          />

          <div className="flex items-center gap-2 rounded-xl bg-[#f3dfe1]/70 px-2.5 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#c17b7f] shadow-[0_2px_8px_rgba(193,123,127,0.12)]"
                aria-hidden="true"
              >
                <UsersIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="wesal-text-bold text-[0.72rem] font-extrabold leading-snug text-[var(--wesal-text)] sm:text-[0.78rem]">
                  {t("owner.visitorStats.conversionTitle")}
                </p>
                <p className="mt-0.5 text-[0.58rem] font-medium leading-snug text-[var(--wesal-muted)]">
                  {t("owner.visitorStats.conversionSubtitle")}
                </p>
              </div>
            </div>
            <span className="hidden h-8 w-px shrink-0 bg-[rgba(168,98,103,0.22)] sm:block" aria-hidden="true" />
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <div className="flex items-center gap-1">
                <TrendIcon />
                <p
                  className="text-base font-extrabold leading-none text-[#c17b7f]"
                  data-testid="owner-visitor-conversion-rate"
                >
                  {formatConversionRate(stats.conversionRateThisMonth, locale)}
                </p>
              </div>
              {conversionDelta != null && conversionDelta !== 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[0.55rem] font-bold ${
                    conversionDelta > 0
                      ? "bg-white/80 text-[#059669]"
                      : "bg-white/80 text-[#b42318]"
                  }`}
                >
                  {t("owner.visitorStats.conversionDelta", {
                    value: formatSignedPercent(conversionDelta, locale, true),
                  })}
                </span>
              ) : (
                <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[0.55rem] font-semibold text-[var(--wesal-muted)]">
                  {t("owner.visitorStats.conversionFlat")}
                </span>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MetricRow({
  icon,
  iconClass,
  title,
  subtitle,
  value,
  change,
  barPercent,
  barClass,
  vsHint,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  subtitle: string;
  value: string;
  change: number | null;
  barPercent: number;
  barClass: string;
  vsHint: string;
}) {
  const up = change != null && change >= 0;
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-[rgba(168,98,103,0.1)] bg-white px-2 py-2 shadow-[0_2px_8px_rgba(90,55,45,0.03)] sm:gap-2">
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${iconClass}`}
        aria-hidden="true"
      >
        {icon}
      </span>

      <div className="min-w-0 w-[4.75rem] shrink-0 sm:w-[5.5rem]">
        <p className="whitespace-pre-line text-[0.68rem] font-extrabold leading-[0.95rem] text-[var(--wesal-text)]">
          {title}
        </p>
        <p className="mt-0.5 truncate text-[0.52rem] font-medium leading-3 text-[var(--wesal-muted)]">
          {subtitle}
        </p>
      </div>

      <div className="min-w-[2rem] flex-1 px-0.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-[#f0ebe8]">
          <div
            className={`h-full rounded-full ${barClass}`}
            style={{ width: `${barPercent}%` }}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <p className="whitespace-nowrap text-[0.7rem] font-extrabold leading-4 text-[var(--wesal-text)]">
          {value}
        </p>
        {change != null ? (
          <div
            className={`rounded-md px-1 py-0.5 text-center ${
              up ? "bg-[rgba(4,120,87,0.1)]" : "bg-[rgba(180,35,24,0.08)]"
            }`}
          >
            <p
              className={`text-[0.55rem] font-extrabold leading-3 ${
                up ? "text-[#047857]" : "text-[#b42318]"
              }`}
            >
              {up ? "↗" : "↘"} {formatSignedPercent(change, "en-GB")}
            </p>
            <p className="text-[0.45rem] font-semibold leading-3 text-[var(--wesal-muted)]">
              {vsHint}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Bar length relative to the largest metric this month (not vs previous, which is often 0 → 100%). */
function barFill(current: number, scaleMax: number): number {
  if (current <= 0) return 8;
  return Math.round(Math.min(92, Math.max(14, (current / Math.max(scaleMax, 1)) * 92)));
}

function formatSignedPercent(
  value: number,
  locale: string,
  keepDecimal = false,
): string {
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat(locale.startsWith("ar") ? "ar-EG" : "en-GB", {
    maximumFractionDigits: keepDecimal ? 1 : 0,
    minimumFractionDigits: keepDecimal && abs % 1 !== 0 ? 1 : 0,
  }).format(abs);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatted}%`;
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path d="M4 19.5h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M7.5 16.5V11M12 16.5V7.5M16.5 16.5v-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 opacity-70" fill="none" aria-hidden="true">
      <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M2.6 12S6.4 6.2 12 6.2 21.4 12 21.4 12 17.6 17.8 12 17.8 2.6 12 2.6 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M12 19.2s-6.8-4.2-8.7-7.8C1.8 8.8 3.1 5.9 6.1 5.5c1.7-.2 3.3.5 4 1.8.7-1.3 2.3-2 4-1.8 3 .4 4.3 3.3 2.8 5.6-1.9 3.6-8.9 8.1-8.9 8.1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <path
        d="M7 3.6h7.4L19.2 8.4V20a1.3 1.3 0 0 1-1.3 1.3H7A1.3 1.3 0 0 1 5.7 20V4.9A1.3 1.3 0 0 1 7 3.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M14.2 3.6V8.2h4.6M8.4 12h7.2M8.4 15.6h5.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <circle cx="9" cy="8.8" r="3.1" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="16.6" cy="9.8" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3.6 18.6c.7-2.7 3-4.2 5.4-4.2s4.7 1.5 5.4 4.2M14.2 14.9c1.8-.2 3.6.7 4.4 2.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#c17b7f]" fill="none" aria-hidden="true">
      <path
        d="M3.5 16.5 8 11l3.5 3.5L20 6.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 6.5h5v5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
