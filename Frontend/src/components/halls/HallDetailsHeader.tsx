"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "@/i18n";
import {
  hydrateSavedHallsFromServer,
  isHallSaved,
  subscribeSavedHalls,
  toggleSavedHall,
} from "@/lib/saved-halls";
import type { HallDetail } from "@/types/hall";

type HallDetailsSection = {
  id: string;
  label: string;
};

type HallDetailsHeaderProps = {
  hall: HallDetail;
  sections: HallDetailsSection[];
  part?: "all" | "title" | "meta" | "tabs";
};

export default function HallDetailsHeader({
  hall,
  sections,
  part = "all",
}: HallDetailsHeaderProps) {
  const t = useT();
  const saved = useSyncExternalStore(
    subscribeSavedHalls,
    () => isHallSaved(hall.id),
    () => false,
  );
  const [copied, setCopied] = useState(false);
  const [shareBump, setShareBump] = useState(0);
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    void hydrateSavedHallsFromServer();
  }, []);

  const rating =
    hall.rating != null && Number.isFinite(hall.rating) ? hall.rating.toFixed(1) : null;
  const reviewCount =
    hall.reviewCount != null && hall.reviewCount > 0 ? hall.reviewCount : null;
  const regionName = t(`region.${hall.region}`);
  const city = t("region.gaza");
  const location = hall.location?.trim() ?? "";
  const street = hall.detailedAddress?.trim() ?? "";
  const place: string[] = [];
  const alreadyNamesCity = location.startsWith(city) || street.startsWith(city);
  if (city && !alreadyNamesCity) place.push(city);
  if (
    regionName &&
    regionName !== city &&
    !location.includes(regionName) &&
    !street.includes(regionName)
  ) {
    place.push(regionName);
  }
  const detail = street || location;
  if (detail && !place.includes(detail)) place.push(detail);

  const share = async () => {
    setShareBump((count) => count + 1);
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: hall.name, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const toggleSaved = () => {
    toggleSavedHall(hall.id);
  };

  const openSection = (id: string) => {
    setActiveId(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showTitle = part === "all" || part === "title";
  const showMeta = part === "all" || part === "meta";
  const showTabs = part === "all" || part === "tabs";

  return (
    <div className="space-y-5">
      {showTitle ? (
        <div data-testid="hall-details-title">
          <p className="text-sm font-bold text-[var(--wesal-maroon)]">
            {t("halls.details.pageKicker")}
          </p>
          <h1 className="mt-1.5 ps-8 text-2xl font-extrabold text-[var(--wesal-text)] sm:ps-12 sm:text-3xl">
            {hall.name}
          </h1>
        </div>
      ) : null}

      {showMeta ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--wesal-text)]">
              <StarIcon />
              {rating ? (
                <span>
                  {rating}
                  {reviewCount != null
                    ? ` (${reviewCount} ${t("halls.details.reviewsCount")})`
                    : ""}
                </span>
              ) : (
                <span>{t("halls.details.ratingLabel")}</span>
              )}
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-[var(--wesal-muted)]">
              <PinIcon />
              <span>{place.join(" - ")}</span>
            </p>
          </div>

          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => void share()}
              className="hall-meta-action inline-flex items-center gap-2 text-sm font-semibold text-[var(--wesal-muted)]"
            >
              <ShareIcon bump={shareBump} />
              {copied ? t("halls.details.shareCopied") : t("halls.details.share")}
            </button>
            <button
              type="button"
              onClick={toggleSaved}
              aria-pressed={saved}
              className="hall-meta-action inline-flex items-center gap-2 text-sm font-semibold text-[var(--wesal-muted)]"
            >
              <HeartIcon filled={saved} />
              {saved ? t("halls.details.saved") : t("halls.details.save")}
            </button>
          </div>
        </div>
      ) : null}

      {showTabs && sections.length > 0 ? (
        <div
          className="flex items-end gap-1 overflow-x-auto overflow-y-hidden border-b border-[var(--wesal-border)] [scrollbar-width:none] sm:justify-between [&::-webkit-scrollbar]:hidden"
          role="tablist"
        >
          {sections.map((section) => {
            const selected = section.id === activeId;
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                onClick={() => openSection(section.id)}
                className={`-mb-px shrink-0 border-b-2 px-3 pb-3 pt-1 text-center text-sm font-bold whitespace-nowrap sm:min-w-0 sm:flex-1 sm:px-2 ${
                  selected
                    ? "border-[var(--wesal-maroon)] text-[var(--wesal-maroon)]"
                    : "border-transparent text-[var(--wesal-muted)] hover:text-[var(--wesal-text)]"
                }`}
                aria-selected={selected}
              >
                {section.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-[var(--wesal-gold)]" aria-hidden="true">
      <path
        fill="currentColor"
        d="m12 3.2 2.2 4.6 5 .7-3.6 3.5.9 5.1L12 14.7 7.5 17.1l.9-5.1L4.8 8.5l5-.7L12 3.2Z"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 size-4 shrink-0 text-[var(--wesal-maroon)]" aria-hidden="true">
      <path d="M12 21s6-5 6-10a6 6 0 1 0-12 0c0 5 6 10 6 10Z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`hall-meta-heart size-5 text-[var(--wesal-maroon)]${filled ? " is-on" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M12 19.4 4.8 12.6a4.2 4.2 0 0 1 6-5.9L12 7.8l1.2-1.1a4.2 4.2 0 0 1 6 5.9L12 19.4Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShareIcon({ bump }: { bump: number }) {
  return (
    <svg
      key={bump}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      className={`hall-meta-share-icon size-5 text-[var(--wesal-maroon)]${bump > 0 ? " is-pop" : ""}`}
      aria-hidden="true"
    >
      <circle cx="6" cy="12" r="2" />
      <circle cx="17" cy="7" r="2" />
      <circle cx="17" cy="17" r="2" />
      <path d="m8 11 7-3M8 13l7 3" />
    </svg>
  );
}
