"use client";

import type { ReactNode } from "react";
import { useT } from "@/i18n";

type HallAmenitiesGridProps = {
  amenities: string[];
};

function amenityIcon(label: string): ReactNode {
  const value = label.toLowerCase();
  if (/صوت|sound|audio|music|speaker|ميغافون/.test(value)) return <SoundIcon />;
  if (/بوفيه|buffet|طعام|food|cater|ضيافة/.test(value)) return <BuffetIcon />;
  if (/موقف|parking|سيارات|car/.test(value)) return <ParkingIcon />;
  if (/تكييف|مكيف|ac|air|cooling|ثلج/.test(value)) return <AcIcon />;
  if (/تجهيز|dressing|غرفة|عروس/.test(value)) return <DressingIcon />;
  if (/حديقة|garden|خارج/.test(value)) return <GardenIcon />;
  if (/إضاءة|led|ضوء|light/.test(value)) return <LightIcon />;
  if (/مولد|generator|كهرباء/.test(value)) return <PowerIcon />;
  return <CheckIcon />;
}

export default function HallAmenitiesGrid({ amenities }: HallAmenitiesGridProps) {
  const t = useT();

  if (!amenities.length) return null;

  return (
    <section
      aria-labelledby="hall-amenities-heading"
      className="hall-section-card hall-amenities-card"
      data-testid="hall-amenities"
    >
      <h2 id="hall-amenities-heading" className="hall-section-title">
        {t("halls.details.amenitiesTitle")}
      </h2>
      <ul className="hall-amenities-grid">
        {amenities.map((amenity, index) => (
          <li
            key={amenity}
            className="hall-amenity-item"
            style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
          >
            <span className="hall-amenity-icon" aria-hidden="true">
              {amenityIcon(amenity)}
            </span>
            <span className="hall-amenity-label">{amenity}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1.35rem] w-[1.35rem]">
      <path d="M5 12.5l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SoundIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1.35rem] w-[1.35rem]">
      <rect x="4" y="8" width="5" height="8" rx="1" />
      <path d="M9 10.5 16 7v10l-7-3.5" strokeLinejoin="round" />
      <path d="M18 9.5a3 3 0 0 1 0 5" strokeLinecap="round" />
    </svg>
  );
}

function BuffetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1.35rem] w-[1.35rem]">
      <path d="M8 4v8M8 12c0 2.5-1.5 4-3 5M8 12c0 2.5 1.5 4 3 5" strokeLinecap="round" />
      <path d="M16 4v16M14 4h4" strokeLinecap="round" />
    </svg>
  );
}

function ParkingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1.35rem] w-[1.35rem]">
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" />
      <path d="M10 16V8h3.2a2.8 2.8 0 0 1 0 5.6H10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AcIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1.35rem] w-[1.35rem]">
      <path d="M12 3v18M12 12 7 7M12 12l5-5M12 12l-5 5M12 12l5 5" strokeLinecap="round" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function DressingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1.35rem] w-[1.35rem]">
      <path d="M8 4h8l2 5H6l2-5Z" strokeLinejoin="round" />
      <path d="M7 9v11h10V9" />
      <path d="M12 9v11" />
    </svg>
  );
}

function GardenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1.35rem] w-[1.35rem]">
      <path d="M12 20V11" strokeLinecap="round" />
      <path d="M12 14c-3.2 0-5.5-2-5.5-4.8C6.5 6.5 9 5 12 7.2 15 5 17.5 6.5 17.5 9.2 17.5 12 15.2 14 12 14Z" strokeLinejoin="round" />
    </svg>
  );
}

function LightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1.35rem] w-[1.35rem]">
      <path d="M9 18h6M10 21h4" strokeLinecap="round" />
      <path d="M8.5 14.5A5 5 0 1 1 15.5 14.5c0 1.7-.8 2.6-1.5 3.5H10c-.7-.9-1.5-1.8-1.5-3.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function PowerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[1.35rem] w-[1.35rem]">
      <rect x="6" y="7" width="12" height="10" rx="2" />
      <path d="M9 17v2M15 17v2M10 11h4" strokeLinecap="round" />
    </svg>
  );
}
