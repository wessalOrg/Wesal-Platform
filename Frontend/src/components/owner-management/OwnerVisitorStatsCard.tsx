"use client";

import type { ReactNode } from "react";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import {
  formatConversionRate,
  formatStatCount,
  percentChange,
  relativeBarPercent,
} from "@/lib/owner-visitor-stats";
import type {
  OwnerVisitorStats,
  OwnerVisitorStatsLoadStatus,
} from "@/types/owner-visitor-stats";

type OwnerVisitorStatsCardProps = {
  status: OwnerVisitorStatsLoadStatus;
  stats: OwnerVisitorStats | null;
  onRetry?: () => void;
};

export default function OwnerVisitorStatsCard({
  status,
  stats,
  onRetry,
}: OwnerVisitorStatsCardProps) {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";

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

  const peak = Math.max(
    stats?.visitsThisMonth ?? 0,
    stats?.favoritesThisMonth ?? 0,
    stats?.bookingRequestsThisMonth ?? 0,
    1,
  );

  return (
    <section
      className="overflow-hidden rounded-[1.35rem] border border-[rgba(168,98,103,0.18)] bg-white p-4 shadow-[0_10px_28px_rgba(90,55,45,0.06)] sm:p-5"
      aria-labelledby="owner-visitor-stats-heading"
      data-testid="owner-visitor-stats"
      data-load-status={status}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]"
              aria-hidden="true"
            >
              <ChartIcon />
            </span>
            <h2
              id="owner-visitor-stats-heading"
              className="text-base font-extrabold text-[var(--wesal-text)] sm:text-[1.05rem]"
            >
              {t("owner.visitorStats.title")}
            </h2>
          </div>
          <p className="mt-1 text-[0.78rem] font-medium text-[var(--wesal-muted)]">
            {t("owner.visitorStats.subtitle")}
          </p>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(168,98,103,0.2)] bg-[#faf7f5] px-2.5 py-1 text-[0.72rem] font-bold text-[var(--wesal-maroon-dark)]">
          <CalendarIcon />
          {t("owner.visitorStats.periodThisMonth")}
        </span>
      </header>

      {status === "loading" || status === "idle" ? (
        <div className="mt-4 space-y-3" aria-busy="true">
          <div className="h-[4.5rem] animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]" />
          <div className="h-[4.5rem] animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]" />
          <div className="h-[4.5rem] animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]" />
          <div className="h-20 animate-pulse rounded-2xl bg-[var(--wesal-pink-soft)]" />
        </div>
      ) : null}

      {status === "error" ? (
        <div className="mt-4 rounded-2xl bg-[rgba(180,35,24,0.06)] px-4 py-3" role="alert">
          <p className="text-sm font-semibold text-[#b42318]">
            {t("owner.visitorStats.loadError")}
          </p>
          {onRetry ? (
            <button type="button" className="btn-outline mt-3" onClick={onRetry}>
              {t("common.retry")}
            </button>
          ) : null}
        </div>
      ) : null}

      {status === "ready" && stats ? (
        <div className="mt-4 space-y-2.5">
          <MetricRow
            icon={<EyeIcon />}
            iconClass="bg-[rgba(107,47,58,0.1)] text-[var(--wesal-maroon)]"
            barClass="bg-[var(--wesal-maroon)]"
            title={t("owner.visitorStats.visitsTitle")}
            subtitle={t("owner.visitorStats.visitsSubtitle")}
            value={t("owner.visitorStats.visitsValue", {
              count: formatStatCount(stats.visitsThisMonth, locale),
            })}
            barPercent={relativeBarPercent(stats.visitsThisMonth, peak)}
            change={visitsChange}
            changeLabel={
              visitsChange == null
                ? null
                : t("owner.visitorStats.vsPreviousMonth", {
                    value: formatSignedPercent(visitsChange, locale),
                  })
            }
          />

          <MetricRow
            icon={<HeartIcon />}
            iconClass="bg-[rgba(196,160,92,0.18)] text-[#8a6a2a]"
            barClass="bg-[#c4a05c]"
            title={t("owner.visitorStats.favoritesTitle")}
            subtitle={t("owner.visitorStats.favoritesSubtitle")}
            value={t("owner.visitorStats.favoritesValue", {
              count: formatStatCount(stats.favoritesThisMonth, locale),
            })}
            barPercent={relativeBarPercent(stats.favoritesThisMonth, peak)}
            change={favoritesChange}
            changeLabel={
              favoritesChange == null
                ? null
                : t("owner.visitorStats.vsPreviousMonth", {
                    value: formatSignedPercent(favoritesChange, locale),
                  })
            }
          />

          <MetricRow
            icon={<DocIcon />}
            iconClass="bg-[var(--wesal-pink-soft)] text-[var(--wesal-maroon)]"
            barClass="bg-[#c97a82]"
            title={t("owner.visitorStats.bookingsTitle")}
            subtitle={t("owner.visitorStats.bookingsSubtitle")}
            value={t("owner.visitorStats.bookingsValue", {
              count: formatStatCount(stats.bookingRequestsThisMonth, locale),
            })}
            barPercent={relativeBarPercent(stats.bookingRequestsThisMonth, peak)}
            change={bookingsChange}
            changeLabel={
              bookingsChange == null
                ? null
                : t("owner.visitorStats.vsPreviousMonth", {
                    value: formatSignedPercent(bookingsChange, locale),
                  })
            }
          />

          <div className="mt-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--wesal-pink-soft)] px-3.5 py-3.5 sm:px-4">
            <div className="flex min-w-0 items-start gap-2.5">
              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[var(--wesal-maroon)] shadow-sm"
                aria-hidden="true"
              >
                <UsersIcon />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-[var(--wesal-text)]">
                  {t("owner.visitorStats.conversionTitle")}
                </p>
                <p className="mt-0.5 text-[0.72rem] font-medium text-[var(--wesal-muted)]">
                  {t("owner.visitorStats.conversionSubtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 ps-11 sm:ps-0">
              <div className="text-start sm:text-end">
                <p
                  className="text-2xl font-extrabold leading-none text-[var(--wesal-maroon-dark)]"
                  data-testid="owner-visitor-conversion-rate"
                >
                  {formatConversionRate(stats.conversionRateThisMonth, locale)}
                </p>
                {conversionDelta != null && conversionDelta !== 0 ? (
                  <p
                    className={`mt-1 text-[0.7rem] font-bold ${
                      conversionDelta > 0 ? "text-[#059669]" : "text-[#b42318]"
                    }`}
                  >
                    {t("owner.visitorStats.conversionDelta", {
                      value: formatSignedPercent(conversionDelta, locale, true),
                    })}
                  </p>
                ) : (
                  <p className="mt-1 text-[0.7rem] font-semibold text-[var(--wesal-muted)]">
                    {t("owner.visitorStats.conversionFlat")}
                  </p>
                )}
              </div>
              <span className="hidden text-[#059669] sm:inline" aria-hidden="true">
                <SparklineIcon />
              </span>
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
  barClass,
  title,
  subtitle,
  value,
  barPercent,
  change,
  changeLabel,
}: {
  icon: ReactNode;
  iconClass: string;
  barClass: string;
  title: string;
  subtitle: string;
  value: string;
  barPercent: number;
  change: number | null;
  changeLabel: string | null;
}) {
  const up = change != null && change >= 0;
  return (
    <div className="rounded-2xl border border-[rgba(168,98,103,0.12)] bg-[#fcfaf9] px-3 py-3 sm:px-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconClass}`}
            aria-hidden="true"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-[var(--wesal-text)]">{title}</p>
            <p className="mt-0.5 text-[0.72rem] font-medium text-[var(--wesal-muted)]">
              {subtitle}
            </p>
          </div>
        </div>
        <p className="text-sm font-extrabold text-[var(--wesal-text)] sm:text-[0.95rem]">
          {value}
        </p>
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white">
        <span
          className={`block h-full rounded-full ${barClass}`}
          style={{ width: `${barPercent}%` }}
        />
      </div>

      {changeLabel ? (
        <p
          className={`mt-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.68rem] font-bold ${
            up
              ? "bg-[rgba(5,150,105,0.1)] text-[#047857]"
              : "bg-[rgba(180,35,24,0.08)] text-[#b42318]"
          }`}
        >
          <span aria-hidden="true">{up ? "↑" : "↓"}</span>
          {changeLabel}
        </p>
      ) : null}
    </div>
  );
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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M4 19h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M7 16V10M12 16V7M17 16v-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
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
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
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

function SparklineIcon() {
  return (
    <svg viewBox="0 0 40 24" className="h-6 w-10" fill="none" aria-hidden="true">
      <path
        d="M2 18 10 12l6 4 10-12 10 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
