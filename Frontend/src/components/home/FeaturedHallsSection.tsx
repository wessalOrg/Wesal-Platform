"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import CatalogHallCard from "@/components/halls/CatalogHallCard";
import RegionFilterBar from "@/components/home/RegionFilterBar";
import Reveal from "@/components/ui/Reveal";
import { useT } from "@/i18n";
import { fetchFeaturedHalls } from "@/services/halls";
import type { FeaturedHall, HallRegion } from "@/types/hall";

const HallDetailsView = dynamic(
  () => import("@/components/halls/HallDetailsView"),
  { ssr: false },
);

type LoadStatus = "loading" | "ready" | "error";

export default function FeaturedHallsSection() {
  const t = useT();
  const [region, setRegion] = useState<HallRegion>("all");
  const [halls, setHalls] = useState<FeaturedHall[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openHallId, setOpenHallId] = useState<string | null>(null);

  const regionEmpty = status === "ready" && halls.length === 0;

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setErrorMessage(null);

    void fetchFeaturedHalls(region).then((result) => {
      if (!active) return;

      if (result.source === "api") {
        setHalls(result.halls);
        setStatus("ready");
        return;
      }

      // Only real user-added halls are shown. If the API is unavailable,
      // show an empty state (never demo/fallback halls).
      setHalls([]);
      setStatus("error");
      setErrorMessage(result.error ?? null);
    });

    return () => {
      active = false;
    };
  }, [region, reloadKey]);

  const handleRegionChange = (next: HallRegion) => {
    if (next === region) return;
    setErrorMessage(null);
    setRegion(next);
    setStatus("loading");
  };

  const handleRetry = () => {
    setErrorMessage(null);
    setStatus("loading");
    setReloadKey((key) => key + 1);
  };

  return (
    <section
      className="bg-[var(--wesal-cream)] py-12 sm:py-16"
      aria-labelledby="featured-halls-heading"
      data-testid="featured-halls-section"
    >
      <Reveal>
      <div className="container-wesal">
        <h2
          id="featured-halls-heading"
          className="text-2xl font-bold text-[var(--wesal-maroon)] sm:text-3xl"
        >
          {t("home.featured.title")}
        </h2>

        <RegionFilterBar
          value={region}
          onChange={handleRegionChange}
          disabled={status === "loading"}
        />

        <div className="mt-4">
          <p className="text-sm text-[var(--wesal-muted)]">{t("home.featured.subtitle")}</p>
        </div>

        {status === "loading" ? (
          <div
            className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="featured-halls-loading"
            aria-busy="true"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <HallCardSkeleton key={index} />
            ))}
          </div>
        ) : null}

        {status === "error" ? (
          <div
            className="mt-6 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-3 text-center sm:text-start"
            data-testid="featured-halls-api-fallback"
            role="status"
          >
            <p className="text-sm text-[var(--wesal-text)]">
              {errorMessage ? `${t("home.featured.offline")} (${errorMessage})` : t("home.featured.offline")}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="btn-outline mt-3"
              data-testid="featured-halls-retry"
            >
              {t("common.retry")}
            </button>
          </div>
        ) : null}

        {status !== "loading" && regionEmpty ? (
          <div
            className="mt-8 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] p-6 text-center"
            data-testid="region-empty-state"
          >
            <p className="text-[var(--wesal-text)]">
              {t("home.featured.empty")}
            </p>
            <button
              type="button"
              onClick={() => handleRegionChange("all")}
              className="btn-outline mt-4"
            >
              {t("home.featured.showAllRegions")}
            </button>
          </div>
        ) : null}

        {status !== "loading" && halls.length > 0 ? (
          <div
            className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            role="tabpanel"
            data-testid="featured-halls-grid"
          >
            {halls.map((hall, index) => (
              <CatalogHallCard
                key={hall.id}
                hall={hall}
                index={index}
                showBookButton
                onOpen={() => setOpenHallId(hall.id)}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-8 flex justify-start">
          <Link
            href="/halls"
            className="btn-primary gap-2"
            data-testid="browse-more-halls"
          >
            {t("home.featured.browseMore")}
            <ChevronIcon />
          </Link>
        </div>
      </div>
      </Reveal>

      {openHallId ? (
        <HallDetailsView hallId={openHallId} onClose={() => setOpenHallId(null)} />
      ) : null}
    </section>
  );
}

function HallCardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)]"
      aria-hidden="true"
    >
      <div className="aspect-[4/3] animate-pulse bg-[var(--wesal-pink)]" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-[rgba(193,123,127,0.18)]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[rgba(193,123,127,0.12)]" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-[rgba(193,123,127,0.12)]" />
      </div>
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
