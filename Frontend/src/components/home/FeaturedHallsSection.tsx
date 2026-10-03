"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import CatalogHallCard from "@/components/halls/CatalogHallCard";
import Reveal from "@/components/ui/Reveal";
import { FEATURED_HALLS_FALLBACK } from "@/constants/featuredHallsFallback";
import { usePublicHallsRevalidation } from "@/hooks/usePublicHallsRevalidation";
import { useT } from "@/i18n";
import { fetchFeaturedHalls } from "@/services/halls";
import type { FeaturedHall } from "@/types/hall";

const HallDetailsView = dynamic(
  () => import("@/components/halls/HallDetailsView"),
  { ssr: false },
);

const FILTERS = ["all", "halls", "planners", "photo"] as const;
const LANDING_PREVIEW_COUNT = 3;

const SERVICE_PLACES = [
  { id: "photo1", category: "photo", image: "/providers/photo-villa-sparkle.jpg" },
  { id: "photo2", category: "photo", image: "/providers/photo-chello-house.jpg" },
  { id: "photo3", category: "photo", image: "/providers/photo-photo-house.jpg" },
  { id: "photo4", category: "photo", image: "/providers/photo-villa-moments.jpg" },
  { id: "decor1", category: "planners", image: "/providers/decor-tulip.jpg" },
  { id: "decor2", category: "planners", image: "/providers/decor-borno.jpg" },
  { id: "decor3", category: "planners", image: "/providers/decor-safeer.jpg" },
  { id: "decor4", category: "planners", image: "/providers/decor-lavender.jpg" },
] as const;

type ProviderFilter = (typeof FILTERS)[number];
type LoadStatus = "loading" | "ready" | "error";

export default function FeaturedHallsSection() {
  const t = useT();
  const [filter, setFilter] = useState<ProviderFilter>("halls");
  const [halls, setHalls] = useState<FeaturedHall[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [openHallId, setOpenHallId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const showsHalls = filter === "all" || filter === "halls";
  const visiblePlaces = SERVICE_PLACES.filter(
    (place) => filter === "all" || place.category === filter,
  );
  const previewHalls =
    showsHalls && status !== "loading" ? halls.slice(0, LANDING_PREVIEW_COUNT) : [];
  const previewPlaces = visiblePlaces.slice(
    0,
    filter === "all"
      ? status === "loading"
        ? 0
        : Math.max(0, LANDING_PREVIEW_COUNT - previewHalls.length)
      : LANDING_PREVIEW_COUNT,
  );

  const requestRevalidate = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  usePublicHallsRevalidation(requestRevalidate);

  useEffect(() => {
    let active = true;
    const soft = hasLoadedRef.current;
    if (soft) {
      setIsRefreshing(true);
    } else {
      setStatus("loading");
      setIsRefreshing(false);
    }

    void fetchFeaturedHalls("all").then((result) => {
      if (!active) return;

      if (result.source === "api") {
        setHalls(result.halls);
        setStatus("ready");
        setErrorMessage(null);
        setIsRefreshing(false);
        hasLoadedRef.current = true;
        return;
      }

      setHalls(FEATURED_HALLS_FALLBACK);
      setStatus("error");
      setErrorMessage(result.error ?? null);
      setIsRefreshing(false);
      hasLoadedRef.current = true;
    });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <section
      className="bg-[var(--wesal-cream)] py-12 sm:py-16"
      aria-labelledby="featured-halls-heading"
      data-testid="featured-halls-section"
    >
      <Reveal>
        <div className="container-wesal">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <h2
                id="featured-halls-heading"
                className="text-2xl font-extrabold text-[var(--wesal-maroon)] sm:text-3xl"
              >
                {t("home.providers.title")}
              </h2>
              <p className="mt-2 text-sm leading-7 text-[var(--wesal-muted)] sm:text-base">
                {t("home.providers.subtitle")}
              </p>
            </div>

            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label={t("home.providers.filterAria")}
            >
              {FILTERS.map((id) => {
                const active = id === filter;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={`provider-filter-${id}`}
                    onClick={() => setFilter(id)}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? "bg-[var(--wesal-maroon)] text-white"
                        : "bg-white text-[var(--wesal-muted)] shadow-[0_6px_16px_rgba(90,55,45,0.06)]"
                    }`}
                  >
                    {t(`home.providers.filter.${id}`)}
                  </button>
                );
              })}
            </div>
          </div>

          {showsHalls && status === "error" ? (
            <div
              className="mt-6 rounded-2xl border border-[var(--wesal-border)] bg-white px-4 py-3 text-center sm:text-start"
              data-testid="featured-halls-api-fallback"
              role="status"
            >
              <p className="text-sm text-[var(--wesal-text)]">
                {errorMessage
                  ? `${t("home.featured.offline")} (${errorMessage})`
                  : t("home.featured.offline")}
              </p>
              <button
                type="button"
                onClick={() => {
                  hasLoadedRef.current = false;
                  setStatus("loading");
                  setReloadKey((key) => key + 1);
                }}
                className="btn-outline mt-3"
                data-testid="featured-halls-retry"
              >
                {t("common.retry")}
              </button>
            </div>
          ) : null}

          {showsHalls && isRefreshing ? (
            <p className="mt-4 text-xs font-semibold text-[var(--wesal-muted)]" role="status">
              {t("home.featured.refreshing")}
            </p>
          ) : null}

          {showsHalls && status === "loading" ? (
            <div
              className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
              data-testid="featured-halls-loading"
              aria-busy="true"
            >
              {Array.from({ length: 3 }).map((_, index) => (
                <ProviderCardSkeleton key={index} />
              ))}
            </div>
          ) : null}

          {showsHalls && status !== "loading" && halls.length === 0 && visiblePlaces.length === 0 ? (
            <p className="mt-8 text-center text-sm text-[var(--wesal-muted)]" role="status">
              {t("home.featured.empty")}
            </p>
          ) : null}

          {(showsHalls && status !== "loading" && previewHalls.length > 0) || previewPlaces.length > 0 ? (
            <div
              className={`mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3${
                showsHalls && isRefreshing ? " pointer-events-none opacity-60" : ""
              }`}
              role="tabpanel"
              data-testid="featured-halls-grid"
              aria-busy={(showsHalls && isRefreshing) || undefined}
            >
              {previewHalls.map((hall, index) => (
                <CatalogHallCard
                  key={hall.id}
                  hall={hall}
                  index={index}
                  showBookButton
                  onOpen={() => setOpenHallId(hall.id)}
                />
              ))}
              {previewPlaces.map((place, index) => (
                <ServicePlaceCard key={place.id} placeId={place.id} image={place.image} index={index} />
              ))}
            </div>
          ) : null}

          <div className="mt-8 flex justify-center">
            <Link
              href="/halls"
              className="inline-flex items-center gap-3 rounded-full border border-[var(--wesal-gold)] bg-white px-6 py-2.5 text-sm font-semibold text-[var(--wesal-gold)] transition-colors hover:bg-[var(--wesal-gold)] hover:text-white"
              data-testid="browse-more-halls"
            >
              {t("home.providers.browseHalls")}
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

function ServicePlaceCard({
  placeId,
  image,
  index,
}: {
  placeId: string;
  image: string;
  index: number;
}) {
  const t = useT();
  const name = t(`home.providers.place.${placeId}.name`);

  return (
    <article
      className="hall-card overflow-hidden rounded-2xl bg-white shadow-[0_10px_28px_rgba(90,55,45,0.08)] ring-1 ring-black/[0.04]"
      style={{ animationDelay: `${index * 90}ms` }}
      data-testid={`service-place-${placeId}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--wesal-pink)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={name} className="h-full w-full object-cover" />
      </div>
      <div className="space-y-2.5 p-4">
        <h3 className="text-base font-bold leading-snug text-[var(--wesal-maroon)]">{name}</h3>
        <p className="text-sm text-[var(--wesal-muted)]">{t(`home.providers.place.${placeId}.area`)}</p>
        <p className="text-sm text-[var(--wesal-text)]">{t(`home.providers.place.${placeId}.note`)}</p>
        <Link
          href="#consult"
          className="btn-primary !min-h-9 inline-flex !rounded-lg !px-3 !text-xs !font-bold !bg-[var(--wesal-maroon-dark)] hover:!bg-[#8a454b]"
        >
          {t("home.providers.inquire")}
        </Link>
      </div>
    </article>
  );
}

function ProviderCardSkeleton() {
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
