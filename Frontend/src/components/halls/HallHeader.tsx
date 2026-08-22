"use client";

import { useT } from "@/i18n";
import type { HallDetail } from "@/types/hall";

type HallHeaderProps = {
  hall: HallDetail;
};

export default function HallHeader({ hall }: HallHeaderProps) {
  const t = useT();
  const capacityLabel = hall.capacityMax
    ? t("common.peopleRange", { min: hall.capacity, max: hall.capacityMax })
    : t("common.peopleCount", { count: hall.capacity });
  const ratingAria =
    hall.rating != null
      ? t("halls.details.ratingAria", { rating: hall.rating })
      : undefined;

  return (
    <header className="space-y-3" data-testid="hall-header">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold leading-snug text-[var(--wesal-text)] sm:text-3xl">
          {hall.name}
        </h1>
        {hall.rating != null ? (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--wesal-pink-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--wesal-text)]"
            aria-label={ratingAria}
          >
            <StarIcon />
            {Number(hall.rating).toFixed(1)}
            {hall.reviewCount != null ? (
              <span className="font-normal text-[var(--wesal-muted)]">
                ({hall.reviewCount})
              </span>
            ) : null}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wesal-pink)] px-3 py-1.5 text-sm font-semibold text-[var(--wesal-maroon-dark)]">
          <GuestsIcon />
          {capacityLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm text-[var(--wesal-muted)]">
          <PinIcon />
          {hall.location}
        </span>
      </div>
    </header>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#E8B923" aria-hidden="true">
      <path d="M12 3.6l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.9 7.2 18.5l.9-5.4L4.2 9.3l5.4-.8L12 3.6Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-[var(--wesal-maroon)]">
      <path
        d="M12 21s6.5-5.4 6.5-10.2A6.5 6.5 0 1 0 5.5 10.8C5.5 15.6 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="10.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function GuestsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-[var(--wesal-maroon)]">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.2 19c.7-3.2 3-4.8 5.8-4.8s5.1 1.6 5.8 4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="17.2" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 14.8c2.1.4 3.7 1.7 4.3 3.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
