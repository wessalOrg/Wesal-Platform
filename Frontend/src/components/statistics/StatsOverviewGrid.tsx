"use client";

import StatCard from "@/components/statistics/StatCard";
import { useT } from "@/i18n";
import type { OwnerStatistics } from "@/types/statistics";

type StatsOverviewGridProps = {
  stats: OwnerStatistics;
  locale: string;
};

function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export default function StatsOverviewGrid({ stats, locale }: StatsOverviewGridProps) {
  const t = useT();

  const cards = [
    {
      id: "saves",
      title: t("statistics.cards.saves"),
      value: formatCount(stats.totalSaveCount, locale),
      icon: <SaveIcon />,
    },
    {
      id: "shares",
      title: t("statistics.cards.shares"),
      value: formatCount(stats.totalShareCount, locale),
      icon: <ShareIcon />,
    },
    {
      id: "postViews",
      title: t("statistics.cards.postViews"),
      value: formatCount(stats.totalPostViewCount, locale),
      icon: <GalleryIcon />,
    },
    {
      id: "profileViews",
      title: t("statistics.cards.profileViews"),
      value: formatCount(stats.profileViewCount, locale),
      icon: <ProfileIcon />,
    },
  ] as const;

  return (
    <section
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      aria-label={t("statistics.overviewLabel")}
      data-testid="stats-overview-grid"
    >
      {cards.map((card) => (
        <StatCard
          key={card.id}
          title={card.title}
          value={card.value}
          icon={card.icon}
          testId={`stat-card-${card.id}`}
        />
      ))}
    </section>
  );
}

function SaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M8 4h8a2 2 0 0 1 2 2v14l-6-3.5L6 20V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="18" cy="5" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="6" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="19" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m8.2 10.8 7.6-4.2M8.2 13.2l7.6 4.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10.5" r="1.6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m6.5 16.5 3.2-3.2 2.3 2.3 3-3.5 3.5 4.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="12" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.5 19c1.2-3.2 3.6-4.8 6.5-4.8S17.3 15.8 18.5 19"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}
