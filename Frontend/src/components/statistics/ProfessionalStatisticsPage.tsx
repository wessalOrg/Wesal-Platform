"use client";

import { useState } from "react";
import Link from "next/link";
import AnalyticsChart from "@/components/statistics/AnalyticsChart";
import RecentPostViewsList from "@/components/statistics/RecentPostViewsList";
import StatsOverviewGrid from "@/components/statistics/StatsOverviewGrid";
import WeeklySummaryBanner from "@/components/statistics/WeeklySummaryBanner";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useProfessionalStatistics } from "@/hooks/useProfessionalStatistics";
import { useT } from "@/i18n";
import type { StatisticsPeriodId } from "@/types/statistics";

export default function ProfessionalStatisticsPage() {
  const t = useT();
  const lang = useUiLang();
  const locale = lang === "ar" ? "ar-EG-u-nu-latn" : "en-US";
  const [period, setPeriod] = useState<StatisticsPeriodId>("30d");
  const { status, stats, errorKey, reload } = useProfessionalStatistics(1, 20);

  if (status === "forbidden") {
    return (
      <section
        className="rounded-[1.25rem] border border-[var(--wesal-border)] bg-white p-6"
        data-testid="statistics-forbidden"
      >
        <h1 className="text-xl font-extrabold text-[var(--wesal-maroon-dark)]">
          {t("statistics.title")}
        </h1>
        <p className="mt-3 text-sm text-[var(--wesal-muted)]">
          {t("statistics.errors.forbidden")}
        </p>
        <Link href="/profile" className="btn-outline mt-5 inline-flex">
          {t("seeker.nav.home")}
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-5" data-testid="professional-statistics-page">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-[var(--wesal-maroon-dark)] sm:text-2xl">
            {t("statistics.title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--wesal-muted)]">
            {t("statistics.subtitle")}
          </p>
        </div>

        <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--wesal-border)] bg-white px-3 text-sm font-semibold text-[var(--wesal-maroon-dark)] shadow-sm">
          <CalendarIcon />
          <span className="sr-only">{t("statistics.period.label")}</span>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as StatisticsPeriodId)}
            className="bg-transparent py-2 outline-none"
            data-testid="statistics-period"
          >
            <option value="30d">{t("statistics.period.30d")}</option>
            <option value="7d">{t("statistics.period.7d")}</option>
            <option value="all">{t("statistics.period.all")}</option>
          </select>
        </label>
      </header>

      <p className="text-xs text-[var(--wesal-muted)]">
        {t("statistics.period.hint")}
      </p>

      {status === "loading" ? (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-busy="true"
        >
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-[7.5rem] animate-pulse rounded-[1.25rem] bg-[var(--wesal-pink-soft)]"
            />
          ))}
        </div>
      ) : null}

      {status === "error" ? (
        <section
          className="rounded-[1.25rem] border border-[#f5c6c2] bg-[#fdecea] p-5"
          role="alert"
        >
          <p className="text-sm text-[#b42318]">
            {errorKey?.startsWith("statistics.") || errorKey?.startsWith("errors.")
              ? t(errorKey)
              : errorKey || t("statistics.errors.loadFailed")}
          </p>
          <button type="button" className="btn-outline mt-3" onClick={() => void reload()}>
            {t("common.retry")}
          </button>
        </section>
      ) : null}

      {status === "ready" && stats ? (
        <>
          <StatsOverviewGrid stats={stats} locale={locale} />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <AnalyticsChart posts={stats.posts} />
            <RecentPostViewsList posts={stats.posts} locale={locale} />
          </div>

          <WeeklySummaryBanner stats={stats} locale={locale} />
        </>
      ) : null}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
