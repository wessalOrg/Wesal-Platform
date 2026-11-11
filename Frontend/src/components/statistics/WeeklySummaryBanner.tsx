"use client";

import { useT } from "@/i18n";
import type { OwnerStatistics } from "@/types/statistics";

type WeeklySummaryBannerProps = {
  stats: OwnerStatistics;
  locale: string;
};

/**
 * Future-ready weekly insights strip (16.2).
 * Populated from GET /statistics/me aggregates until a dedicated weekly endpoint exists.
 */
export default function WeeklySummaryBanner({
  stats,
  locale,
}: WeeklySummaryBannerProps) {
  const t = useT();
  const fmt = (n: number) => new Intl.NumberFormat(locale).format(n);

  const insight =
    stats.totalSaveCount > 0
      ? t("statistics.summary.insightSaves", { count: fmt(stats.totalSaveCount) })
      : stats.totalPostViewCount > 0
        ? t("statistics.summary.insightViews", {
            count: fmt(stats.totalPostViewCount),
          })
        : t("statistics.summary.insightEmpty");

  const chips = [
    {
      id: "saves",
      label: t("statistics.summary.chipSaves", { count: fmt(stats.totalSaveCount) }),
      icon: <UsersPlusIcon />,
    },
    {
      id: "shares",
      label: t("statistics.summary.chipShares", { count: fmt(stats.totalShareCount) }),
      icon: <HeartIcon />,
    },
    {
      id: "comments",
      label: t("statistics.summary.chipPostViews", {
        count: fmt(stats.totalPostViewCount),
      }),
      icon: <CommentIcon />,
    },
  ] as const;

  return (
    <section
      className="overflow-hidden rounded-[1.25rem] border border-[var(--wesal-border)] bg-[linear-gradient(120deg,color-mix(in_srgb,var(--wesal-maroon)_10%,white),var(--wesal-pink-soft))] p-4 sm:p-5"
      data-testid="weekly-summary-banner"
      aria-label={t("statistics.summary.title")}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wesal-maroon)] text-white"
              aria-hidden="true"
            >
              <BoltIcon />
            </span>
            <h2 className="text-base font-extrabold text-[var(--wesal-maroon-dark)]">
              {t("statistics.summary.title")}
            </h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--wesal-muted)]">{insight}</p>
        </div>

        <ul className="flex flex-wrap gap-2 lg:justify-end">
          {chips.map((chip) => (
            <li
              key={chip.id}
              className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-xs font-bold text-[var(--wesal-maroon-dark)] shadow-[0_0.25rem_0.75rem_rgba(90,55,45,0.06)] ring-1 ring-[var(--wesal-border)]"
            >
              <span className="text-[var(--wesal-maroon)]" aria-hidden="true">
                {chip.icon}
              </span>
              {chip.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M13 3 6 13h5l-1 8 8-11h-5l0-7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UsersPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 18c.8-2.6 2.8-4 5.5-4s4.7 1.4 5.5 4M17 8v6M14 11h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M12 19.2 5.4 12.8a3.8 3.8 0 0 1 5.4-5.4L12 8.6l1.2-1.2a3.8 3.8 0 0 1 5.4 5.4L12 19.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M5 6.5h14v9.5H10l-4 3v-3H5V6.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
