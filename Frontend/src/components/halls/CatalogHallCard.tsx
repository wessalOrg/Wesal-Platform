"use client";

import Link from "next/link";
import { GoldStar } from "@/components/ui/GoldStar";
import HallMedia from "@/components/halls/HallMedia";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import {
  localizeBookedSummary,
  localizeHallName,
  localizeLocation,
  localizePriceLabel,
  localizeTag,
} from "@/lib/localize-hall-display";
import type { FeaturedHall } from "@/types/hall";

type CatalogHallCardProps = {
  hall: FeaturedHall;
  onOpen: () => void;
  showBookButton?: boolean;
  index?: number;
};

export default function CatalogHallCard({
  hall,
  onOpen,
  showBookButton = false,
  index = 0,
}: CatalogHallCardProps) {
  const t = useT();
  const lang = useUiLang();
  const name = localizeHallName(hall.id, hall.name, lang);
  const location = localizeLocation(hall.location, lang);
  const priceLabel = localizePriceLabel(hall.priceLabel, lang);
  const bookedSummary = localizeBookedSummary(hall.bookedPeriodsSummary, lang);
  const capacityLabel = hall.capacityMax
    ? t("common.peopleRange", { min: hall.capacity, max: hall.capacityMax })
    : t("common.peopleCount", { count: hall.capacity });
  const openTag = isHallOpen(hall);
  const statusTags = new Set([
    t("halls.catalog.open"),
    t("halls.catalog.closed"),
    "مفتوحة",
    "مغلقة",
    "Open",
    "Closed",
  ]);
  const extraTags = (hall.tags ?? [])
    .filter((tag) => !statusTags.has(tag))
    .slice(0, 1)
    .map((tag) => localizeTag(tag, lang));

  return (
    <article
      className="hall-card group overflow-hidden rounded-2xl bg-white shadow-[0_10px_28px_rgba(90,55,45,0.08)] ring-1 ring-black/[0.04] transition-[box-shadow] duration-200 hover:shadow-[0_16px_36px_rgba(90,55,45,0.12)]"
      style={{ animationDelay: `${index * 90}ms` }}
      data-testid={`hall-card-${hall.id}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--wesal-pink)]">
        <button
          type="button"
          onClick={onOpen}
          className="absolute inset-0 cursor-pointer"
          aria-label={name}
        >
          <HallMedia
            src={hall.imageUrl}
            alt={name}
            className="absolute inset-0 h-full w-full object-cover object-center"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            priority={index < 2}
          />
        </button>
        <button
          type="button"
          className="absolute top-3 end-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/95 text-[var(--wesal-maroon)] shadow"
          aria-label={t("halls.catalog.favorite")}
        >
          <HeartIcon />
        </button>
        {priceLabel ? (
          <span className="hall-price-badge absolute bottom-3 start-3 z-10">
            {formatPriceLabel(priceLabel)}
          </span>
        ) : null}
      </div>

      <div className="space-y-3 p-4">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full cursor-pointer space-y-2.5 text-start"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-bold leading-snug text-[var(--wesal-maroon)]">
              {name}
            </h3>
            {hall.rating != null ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--wesal-text)]">
                {Number(hall.rating).toFixed(1)}
                <GoldStar size={14} />
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-[var(--wesal-muted)]">
            <span className="inline-flex items-center gap-1.5">
              <PinIcon />
              {location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <GuestsIcon />
              {capacityLabel}
            </span>
          </div>

          {bookedSummary ? (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--wesal-maroon-soft)]">
              <CalendarIcon />
              <span>
                {t("home.featured.bookedPrefix")}{" "}
                <span className="text-[var(--wesal-maroon)]">{bookedSummary}</span>
              </span>
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700/80">
              <CalendarIcon />
              {t("halls.catalog.available")}
            </p>
          )}
        </button>

        <div className="flex items-end justify-between gap-3 pt-1">
          <div className="flex min-w-0 flex-wrap gap-2">
            <span className="rounded-full bg-[#f3eeea] px-2.5 py-1 text-xs font-medium text-[var(--wesal-text)]">
              {openTag ? t("halls.catalog.open") : t("halls.catalog.closed")}
            </span>
            {extraTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#f3eeea] px-2.5 py-1 text-xs font-medium text-[var(--wesal-text)]"
              >
                {tag}
              </span>
            ))}
          </div>
          {showBookButton ? (
            <Link
              href={`/register?redirect=/halls/${hall.id}&intent=book`}
              className="btn-primary !min-h-9 shrink-0 !rounded-lg !px-3 !text-xs !font-bold !bg-[var(--wesal-maroon-dark)] hover:!bg-[#8a454b]"
              onClick={(event) => event.stopPropagation()}
            >
              {t("halls.catalog.bookNow")}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function isHallOpen(hall: FeaturedHall) {
  const days = hall.availabilityDays ?? [];
  if (days.length > 0) {
    return days.some((day) =>
      day.periods.some((period) => period.status === "available"),
    );
  }
  return !hall.bookedPeriodsSummary;
}

function formatPriceLabel(label: string) {
  if (label.includes("₪")) return label;
  return label.replace(/^([\d,.]+)\s*/, "$1 ₪ ");
}

function HeartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--wesal-maroon)]"
    >
      <path
        d="M12 21s6.5-5.4 6.5-10.2A6.5 6.5 0 1 0 5.5 10.8C5.5 15.6 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="10.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--wesal-maroon)]"
    >
      <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4 9h16M8 3v4M16 3v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GuestsIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-[var(--wesal-maroon)]"
    >
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.2 19c.7-3.2 3-4.8 5.8-4.8s5.1 1.6 5.8 4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
