"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoldStar } from "@/components/ui/GoldStar";
import HallLockedBadge from "@/components/halls/HallLockedBadge";
import HallMedia from "@/components/halls/HallMedia";
import { useHallPermissions } from "@/hooks/useHallPermissions";
import { useUiLang } from "@/components/layout/LanguageProvider";
import { useT } from "@/i18n";
import { buildHallDetailsPath } from "@/lib/booking-intent";
import type { HallActionPermissions } from "@/lib/hall-action-permissions";
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
  onOpen?: () => void;
  showBookButton?: boolean;
  index?: number;
  /** Denser card for the halls catalog page. */
  compact?: boolean;
};

export default function CatalogHallCard({
  hall,
  onOpen,
  showBookButton = false,
  index = 0,
  compact = false,
}: CatalogHallCardProps) {
  const t = useT();
  const lang = useUiLang();
  const router = useRouter();
  const permissions = useHallPermissions();
  const openPopupOrDetails = () => {
    if (onOpen) {
      onOpen();
      return;
    }
    router.push(buildHallDetailsPath(hall.id));
  };
  const bookHref = catalogBookHref(hall.id, permissions);
  const hallUnavailable = hall.isAvailable === false;
  const name = localizeHallName(hall.id, hall.name, lang);
  const location = localizeLocation(hall.location, lang);
  const priceLabel = localizePriceLabel(hall.priceLabel, lang);
  const bookedSummary = localizeBookedSummary(hall.bookedPeriodsSummary, lang);
  const capacityLabel = hall.capacityMax
    ? t("common.peopleRange", {
        min: Math.min(hall.capacity, hall.capacityMax),
        max: Math.max(hall.capacity, hall.capacityMax),
      })
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
      className={`hall-card group overflow-hidden border-0 bg-[var(--wesal-white)] transition-[box-shadow] duration-200 ${
        compact
          ? "rounded-xl shadow-[0_8px_20px_rgba(90,55,45,0.07)] hover:shadow-[0_12px_28px_rgba(90,55,45,0.11)]"
          : "rounded-2xl shadow-[0_10px_28px_rgba(90,55,45,0.08)] hover:shadow-[0_16px_36px_rgba(90,55,45,0.12)]"
      }`}
      style={{ animationDelay: `${index * 90}ms` }}
      data-testid={`hall-card-${hall.id}`}
    >
      <div
        className={`relative overflow-hidden bg-[var(--wesal-pink)] ${
          compact ? "aspect-[3/2]" : "aspect-[4/3]"
        }`}
      >
        <button
          type="button"
          onClick={openPopupOrDetails}
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
        {hallUnavailable ? (
          <HallLockedBadge
            variant="public"
            className={`absolute z-10 ${compact ? "start-2.5 top-2.5" : "start-3 top-3"}`}
          />
        ) : null}
        {priceLabel ? (
          <span
            className={`hall-price-badge absolute z-10 ${
              compact
                ? "bottom-2 start-2 !px-2.5 !py-1 !text-[0.7rem]"
                : "bottom-3 start-3"
            }`}
          >
            {formatPriceLabel(priceLabel)}
          </span>
        ) : null}
      </div>

      <div className={compact ? "space-y-2 p-3" : "space-y-3 p-4"}>
        <button
          type="button"
          onClick={openPopupOrDetails}
          className={`block w-full cursor-pointer text-start ${
            compact ? "space-y-1.5" : "space-y-2.5"
          }`}
        >
          <div className={`flex items-start justify-between ${compact ? "gap-2" : "gap-3"}`}>
            <h3
              className={`font-bold leading-snug text-[var(--wesal-maroon)] ${
                compact ? "text-sm" : "text-base"
              }`}
            >
              {name}
            </h3>
            {hall.rating != null ? (
              <span
                className={`inline-flex shrink-0 items-center gap-1 font-semibold text-[var(--wesal-text)] ${
                  compact ? "text-xs" : "text-sm"
                }`}
              >
                {Number(hall.rating).toFixed(1)}
                <GoldStar size={compact ? 12 : 14} />
              </span>
            ) : null}
          </div>

          <div
            className={`flex flex-wrap items-center text-[var(--wesal-muted)] ${
              compact
                ? "gap-x-3 gap-y-1 text-xs"
                : "gap-x-4 gap-y-1.5 text-sm"
            }`}
          >
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

        <div className={`flex items-end justify-between gap-2 ${compact ? "pt-0.5" : "pt-1"}`}>
          <div className={`flex min-w-0 flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
            <span
              className={`hall-card-tag rounded-full bg-[var(--wesal-pink)] font-medium text-[var(--wesal-maroon-dark)] ${
                compact ? "px-2 py-0.5 text-[0.68rem]" : "px-2.5 py-1 text-xs"
              }`}
            >
              {openTag ? t("halls.catalog.open") : t("halls.catalog.closed")}
            </span>
            {extraTags.map((tag) => (
              <span
                key={tag}
                className={`hall-card-tag rounded-full bg-[var(--wesal-pink)] font-medium text-[var(--wesal-maroon-dark)] ${
                  compact ? "px-2 py-0.5 text-[0.68rem]" : "px-2.5 py-1 text-xs"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
          {showBookButton && bookHref && !hallUnavailable ? (
            <Link
              href={bookHref}
              className={`hall-card-book btn-primary shrink-0 !rounded-lg !font-bold ${
                compact
                  ? "!min-h-8 !px-2.5 !text-[0.7rem]"
                  : "!min-h-9 !px-3 !text-xs"
              }`}
              data-testid="hall-card-book-now"
              onClick={(event) => event.stopPropagation()}
            >
              {t("halls.catalog.bookNow")}
            </Link>
          ) : null}
          {showBookButton && hallUnavailable ? (
            <button
              type="button"
              className={`hall-card-book btn-primary shrink-0 !rounded-lg !font-bold !opacity-50 ${
                compact
                  ? "!min-h-8 !px-2.5 !text-[0.7rem]"
                  : "!min-h-9 !px-3 !text-xs"
              }`}
              disabled
              aria-disabled="true"
            >
              {t("halls.catalog.bookNow")}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function catalogBookHref(hallId: string, permissions: HallActionPermissions) {
  if (!permissions.authReady) return buildHallDetailsPath(hallId, true);
  if (permissions.canBook || permissions.isGuest) {
    return buildHallDetailsPath(hallId, true);
  }
  return null;
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
