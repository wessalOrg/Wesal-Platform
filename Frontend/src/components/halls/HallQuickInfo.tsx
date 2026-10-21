"use client";

import type { ReactNode } from "react";
import { useT } from "@/i18n";
import type { HallDetail, HallSlotPrice } from "@/types/hall";

type HallQuickInfoProps = {
  hall: HallDetail;
};

function startingPriceLabel(slotPrices: HallSlotPrice[], fromLabel: string): ReactNode {
  const priced = slotPrices
    .map((slot) => slot.price)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price));
  if (priced.length) {
    const min = Math.min(...priced);
    return (
      <>
        {fromLabel}{" "}
        <span dir="ltr" className="inline-flex items-baseline gap-1">
          {min.toLocaleString("en-US")}
          <ShekelMark />
        </span>
      </>
    );
  }
  const labeled = slotPrices.find((slot) => slot.priceLabel?.trim())?.priceLabel?.trim();
  if (!labeled) return "—";
  const amount = labeled.replace(/₪/g, "").trim();
  return (
    <>
      {fromLabel}{" "}
      <span dir="ltr" className="inline-flex items-baseline gap-1">
        {amount}
        <ShekelMark />
      </span>
    </>
  );
}

function ShekelMark() {
  return (
    <span className="font-['Segoe_UI','Arial',sans-serif] text-[0.95em] leading-none" aria-hidden="true">
      ₪
    </span>
  );
}

function capacityLabel(hall: HallDetail, peopleWord: string): string {
  if (hall.capacityMax && hall.capacityMax !== hall.capacity) {
    return `${hall.capacity}-${hall.capacityMax} ${peopleWord}`;
  }
  return `${hall.capacity} ${peopleWord}`;
}

export default function HallQuickInfo({ hall }: HallQuickInfoProps) {
  const t = useT();
  const regionKey = `region.${hall.region}`;
  const regionLabel = t(regionKey);
  const items: { id: string; label: string; value: ReactNode; icon: ReactNode }[] = [
    {
      id: "capacity",
      label: t("halls.details.capacity"),
      value: capacityLabel(hall, t("halls.details.people")),
      icon: <CapacityIcon />,
    },
    {
      id: "price",
      label: t("halls.details.priceLabel"),
      value: startingPriceLabel(hall.slotPrices, t("halls.details.priceFrom")),
      icon: <PriceIcon />,
    },
    {
      id: "region",
      label: t("halls.details.area"),
      value: regionLabel || hall.location,
      icon: <LocationIcon />,
    },
    {
      id: "booking",
      label: t("halls.details.bookingOptions"),
      value: t("halls.details.bookingHourly"),
      icon: <ClockIcon />,
    },
  ];

  return (
    <ul
      className="hall-quick-info grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5"
      data-testid="hall-quick-info"
    >
      {items.map((item) => (
        <li key={item.id} className="hall-quick-info-card">
          <div className="min-w-0">
            <p className="text-[0.7rem] font-semibold text-[var(--wesal-muted)] sm:text-xs">
              {item.label}
            </p>
            <p
              className={`mt-0.5 text-sm font-bold leading-snug text-[var(--wesal-text)] ${
                item.id === "price"
                  ? "whitespace-normal break-words text-[0.78rem] sm:text-sm"
                  : "truncate"
              }`}
            >
              {item.value}
            </p>
          </div>
          <span className="hall-quick-info-icon" aria-hidden="true">
            {item.icon}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

function PriceIcon() {
  return (
    <span
      className="relative -top-[3px] text-[1.7rem] font-bold leading-none"
      style={{ fontFamily: '"Segoe UI", Arial, sans-serif' }}
    >
      ₪
    </span>
  );
}
