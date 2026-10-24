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
      className="overflow-hidden rounded-2xl border border-[rgba(168,98,103,0.16)] bg-[#faf8f6] p-3 shadow-[0_6px_18px_rgba(90,55,45,0.05)] sm:p-3.5"
      aria-labelledby="owner-visitor-stats-heading"
      data-testid="owner-visitor-stats"
      data-load-status={status}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-1.5">
          <span
            className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]"
            aria-hidden="true"
          >
            <ChartIcon />
          </span>
          <div className="min-w-0">
            <h2
              id="owner-visitor-stats-heading"
              className="truncate text-[0.82rem] font-extrabold leading-4 text-[var(--wesal-maroon)]"
            >
              {t("owner.visitorStats.title")}
            </h2>
            <p className="mt-0.5 truncate text-[0.62rem] font-medium leading-3 text-[var(--wesal-muted)]">
              {scopeLabel ?? t("owner.visitorStats.subtitle")}
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[rgba(168,98,103,0.18)] bg-white px-2 py-0.5 text-[0.62rem] font-bold text-[var(--wesal-maroon-dark)]">
          <CalendarIcon />
          {t("owner.visitorStats.periodThisMonth")}
        </span>
      </header>

      {status === "loading" || status === "idle" ? (
        <div className="mt-2.5 space-y-1.5" aria-busy="true">
          <div className="h-11 animate-pulse rounded-xl bg-[var(--wesal-pink-soft)]" />
          <div className="h-11 animate-pulse rounded-xl bg-[var(--wesal-pink-soft)]" />
          <div className="h-11 animate-pulse rounded-xl bg-[var(--wesal-pink-soft)]" />
          <div className="h-10 animate-pulse rounded-xl bg-[var(--wesal-pink-soft)]" />
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
            iconClass="bg-[rgba(193,123,127,0.14)] text-[var(--wesal-maroon)]"
            title={t("owner.visitorStats.visitsTitle")}
            subtitle={t("owner.visitorStats.visitsSubtitle")}
            value={t("owner.visitorStats.visitsValue", {
              count: formatStatCount(stats.visitsThisMonth, locale),
            })}
            change={visitsChange}
            barPercent={barFill(stats.visitsThisMonth, barScale)}
            barClass="bg-[var(--wesal-maroon)]"
            vsHint={t("owner.visitorStats.vsPreviousHint")}
          />
          <MetricRow
            icon={<HeartIcon />}
            iconClass="bg-[rgba(196,160,92,0.16)] text-[#8a6a2a]"
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
            iconClass="bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon-dark)]"
            title={t("owner.visitorStats.bookingsTitle")}
            subtitle={t("owner.visitorStats.bookingsSubtitle")}
            value={t("owner.visitorStats.bookingsValue", {
              count: formatStatCount(stats.bookingRequestsThisMonth, locale),
            })}
            change={bookingsChange}
            barPercent={barFill(stats.bookingRequestsThisMonth, barScale)}
            barClass="bg-[var(--wesal-maroon-soft)]"
            vsHint={t("owner.visitorStats.vsPreviousHint")}
          />

          <div className="flex items-center gap-2 rounded-xl bg-[var(--wesal-pink-soft)] px-2.5 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[var(--wesal-maroon)]"
                aria-hidden="true"
              >
                <UsersIcon />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.68rem] font-bold leading-3 text-[var(--wesal-text)]">
                  {t("owner.visitorStats.conversionTitle")}
                </p>
                <p className="mt-0.5 truncate text-[0.58rem] font-medium leading-3 text-[var(--wesal-muted)]">
                  {t("owner.visitorStats.conversionSubtitle")}
                </p>
              </div>
            </div>
            <span className="h-7 w-px shrink-0 bg-[rgba(168,98,103,0.2)]" aria-hidden="true" />
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <div className="flex items-center gap-1">
                <SparkIcon />
                <p
                  className="text-sm font-extrabold leading-none text-[var(--wesal-maroon-dark)]"
                  data-testid="owner-visitor-conversion-rate"
                >
                  {formatConversionRate(stats.conversionRateThisMonth, locale)}
                </p>
              </div>
              {conversionDelta != null && conversionDelta !== 0 ? (
                <p
                  className={`text-[0.55rem] font-bold leading-3 ${
                    conversionDelta > 0 ? "text-[#059669]" : "text-[#b42318]"
                  }`}
                >
                  {t("owner.visitorStats.conversionDelta", {
                    value: formatSignedPercent(conversionDelta, locale, true),
                  })}
                </p>
              ) : (
                <p className="text-[0.55rem] font-semibold leading-3 text-[var(--wesal-muted)]">
                  {t("owner.visitorStats.conversionFlat")}
                </p>
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
    <div className="flex items-center gap-2 rounded-xl border border-[rgba(168,98,103,0.12)] bg-white px-2 py-1.5">
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${iconClass}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[0.68rem] font-extrabold leading-3 text-[var(--wesal-text)]">
              {title}
            </p>
            <p className="mt-0.5 truncate text-[0.55rem] font-medium leading-3 text-[var(--wesal-muted)]">
              {subtitle}
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-1.5">
            <p className="text-[0.72rem] font-extrabold leading-3 text-[var(--wesal-text)]">
              {value}
            </p>
            {change != null ? (
              <div
                className={`rounded-md px-1 py-0.5 text-center ${
                  up ? "bg-[rgba(4,120,87,0.08)]" : "bg-[rgba(180,35,24,0.08)]"
                }`}
              >
                <p
                  className={`text-[0.55rem] font-extrabold leading-3 ${
                    up ? "text-[#047857]" : "text-[#b42318]"
                  }`}
                >
                  {up ? "↑" : "↓"} {formatSignedPercent(change, "en-GB")}
                </p>
                <p className="text-[0.48rem] font-semibold leading-3 text-[var(--wesal-muted)]">
                  {vsHint}
                </p>
              </div>
            ) : null}
          </div>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f0ebe8]">
          <div
            className={`h-full rounded-full ${barClass}`}
            style={{ width: `${barPercent}%` }}
          />
        </div>
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
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 16V10M12 16V7M17 16v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
      <path
        d="M2.8 12S6.2 6.5 12 6.5 21.2 12 21.2 12 17.8 17.5 12 17.5 2.8 12 2.8 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
      <path
        d="M12 19s-6.5-4.1-8.4-7.6C2.2 9.2 3.4 6.5 6.2 6.1c1.6-.2 3.1.5 3.8 1.7.7-1.2 2.2-1.9 3.8-1.7 2.8.4 4 3.1 2.6 5.3C18.5 14.9 12 19 12 19Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
      <path
        d="M7 3.8h7.2L19 8.5V20a1.2 1.2 0 0 1-1.2 1.2H7A1.2 1.2 0 0 1 5.8 20V5A1.2 1.2 0 0 1 7 3.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 3.8V8h4.5M8.5 12h7M8.5 15.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
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

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3 text-[var(--wesal-maroon)]" fill="none" aria-hidden="true">
      <path
        d="M4 16c2-1.5 4.2-4.5 5.2-7.2.5 2.4 1.8 4.6 3.8 6.2 1.4-2 3.4-3.4 5.5-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
