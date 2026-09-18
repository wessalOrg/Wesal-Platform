"use client";

import type { ReactNode } from "react";
import { useT } from "@/i18n";
import type { HallDetail, HallSlotPrice } from "@/types/hall";

type HallQuickInfoProps = {
  hall: HallDetail;
};

function startingPriceLabel(slotPrices: HallSlotPrice[], fromLabel: string): string {
  const priced = slotPrices
    .map((slot) => slot.price)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price));
  if (priced.length) {
    const min = Math.min(...priced);
    return `${fromLabel} ${min.toLocaleString("en-US")} ₪`;
  }
  const labeled = slotPrices.find((slot) => slot.priceLabel?.trim())?.priceLabel?.trim();
  return labeled ? `${fromLabel} ${labeled}` : "—";
}

function capacityLabel(hall: HallDetail, peopleWord: string): string {
  if (hall.capacityMax && hall.capacityMax !== hall.capacity) {
    return `${hall.capacity}-${hall.capacityMax} ${peopleWord}`;
  }
  return `${hall.capacity} ${peopleWord}`;
}

export default function HallQuickInfo({ hall }: HallQuickInfoProps) {
  const t = useT();
  const rating =
    hall.rating != null && Number.isFinite(hall.rating)
      ? hall.rating.toFixed(1)
      : "—";
  const ratingValue =
    hall.reviewCount != null && hall.reviewCount > 0 && rating !== "—"
      ? `${rating} (${hall.reviewCount} ${t("halls.details.reviewsCount")})`
      : rating;

  const items: { id: string; label: string; value: string; icon: ReactNode }[] = [
    {
      id: "capacity",
      label: t("halls.details.capacity"),
      value: capacityLabel(hall, t("halls.details.people")),
      icon: <CapacityIcon />,
    },
    {
      id: "location",
      label: t("halls.details.location"),
      value: hall.location,
      icon: <LocationIcon />,
    },
    {
      id: "rating",
      label: t("halls.details.ratingLabel"),
      value: ratingValue,
      icon: <StarIcon />,
    },
    {
      id: "price",
      label: t("halls.details.priceLabel"),
      value: startingPriceLabel(hall.slotPrices, t("halls.details.priceFrom")),
      icon: <PriceIcon />,
    },
  ];

  return (
    <ul
      className="hall-quick-info grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5"
      data-testid="hall-quick-info"
    >
      {items.map((item) => (
        <li key={item.id} className="hall-quick-info-card">
          <span className="hall-quick-info-icon" aria-hidden="true">
            {item.icon}
          </span>
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold text-[var(--wesal-muted)] sm:text-xs">
              {item.label}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-[var(--wesal-text)]">
              {item.value}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function CapacityIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <circle cx="9" cy="8" r="2.4" />
      <circle cx="15.5" cy="8.5" r="2" />
      <path d="M4.5 18.5c1.2-2.6 3-3.8 4.5-3.8s3.3 1.2 4.5 3.8" strokeLinecap="round" />
      <path d="M13.2 14.8c1-.7 2.1-1 3.3-1 1.5 0 2.9.8 3.9 2.7" strokeLinecap="round" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <path d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.8 12 21 12 21Z" />
      <circle cx="12" cy="10.5" r="2.2" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="m12 3.6 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.9 7.2 18.5l.9-5.4L4.2 9.3l5.4-.8L12 3.6Z" />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <circle cx="12" cy="12" r="8.25" />
      <path
        d="M12 7.5v9M9.5 9.5c.6-.8 1.5-1.2 2.5-1.2 1.5 0 2.6.8 2.6 2.1S13.5 12.5 12 12.5 9.4 13.3 9.4 14.6c0 1.3 1.2 2.1 2.6 2.1 1 0 1.9-.4 2.5-1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
