"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import CatalogHallCard from "@/components/halls/CatalogHallCard";
import Reveal from "@/components/ui/Reveal";
import { usePublicHallsRevalidation } from "@/hooks/usePublicHallsRevalidation";
import { useT } from "@/i18n";
import { discoverItemHref } from "@/lib/discover-filter";
import { fetchDiscoverFeed } from "@/services/discover";
import { fetchFeaturedHalls } from "@/services/halls";
import type { FeaturedHall } from "@/types/hall";
import type { DiscoverItem } from "@/types/offers";

const HallDetailsView = dynamic(
  () => import("@/components/halls/HallDetailsView"),
  { ssr: false },
);

const FILTERS = ["all", "halls", "planners", "photo"] as const;
const LANDING_PREVIEW_COUNT = 3;

type ProviderFilter = (typeof FILTERS)[number];
type LoadStatus = "loading" | "ready" | "error";

export default function FeaturedHallsSection() {
  const t = useT();
  const [filter, setFilter] = useState<ProviderFilter>("all");
  const [halls, setHalls] = useState<FeaturedHall[]>([]);
  const [photographers, setPhotographers] = useState<DiscoverItem[]>([]);
  const [planners, setPlanners] = useState<DiscoverItem[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [prosStatus, setProsStatus] = useState<LoadStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [openHallId, setOpenHallId] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const showsHalls = filter === "all" || filter === "halls";
  const showsPros = filter === "all" || filter === "photo" || filter === "planners";
  const sectionLoading =
    (showsHalls && status === "loading") || (showsPros && prosStatus === "loading");

  let previewHalls: FeaturedHall[] = [];
  let previewProviders: DiscoverItem[] = [];
  if (!sectionLoading) {
    if (filter === "halls") {
      previewHalls = halls.slice(0, LANDING_PREVIEW_COUNT);
    } else if (filter === "photo") {
      previewProviders = photographers.slice(0, LANDING_PREVIEW_COUNT);
    } else if (filter === "planners") {
      previewProviders = planners.slice(0, LANDING_PREVIEW_COUNT);
    } else {
      previewHalls = halls.slice(0, 1);
      previewProviders = [
        ...photographers.slice(0, 1),
        ...planners.slice(0, 1),
      ];
      const slotsLeft = Math.max(
        0,
        LANDING_PREVIEW_COUNT - previewHalls.length - previewProviders.length,
      );
      if (slotsLeft > 0 && halls.length > previewHalls.length) {
        previewHalls = halls.slice(0, previewHalls.length + slotsLeft);
      }
    }
  }

  const browseHref = filter === "halls" ? "/halls" : "/discover";
  const hasPreview = previewHalls.length > 0 || previewProviders.length > 0;

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
      setProsStatus("loading");
      setIsRefreshing(false);
    }

    void fetchFeaturedHalls("all").then((result) => {
      if (!active) return;

      setHalls(result.halls);
      if (result.source === "api") {
        setStatus("ready");
        setErrorMessage(null);
      } else {
        setStatus("error");
        setErrorMessage(result.error ?? null);
      }
      setIsRefreshing(false);
      hasLoadedRef.current = true;
    });

    void Promise.all([
      fetchDiscoverFeed("Photographers", 1, LANDING_PREVIEW_COUNT),
      fetchDiscoverFeed("EventCoordinators", 1, LANDING_PREVIEW_COUNT),
    ])
      .then(([photoPage, plannerPage]) => {
        if (!active) return;
        setPhotographers(
          photoPage.items.filter((item) => item.contentType === "Photographer"),
        );
        setPlanners(
          plannerPage.items.filter(
            (item) => item.contentType === "EventCoordinator",
          ),
        );
        setProsStatus("ready");
      })
      .catch(() => {
        if (!active) return;
        setPhotographers([]);
        setPlanners([]);
        setProsStatus("error");
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <section
      className="bg-[var(--wesal-cream)] py-11 sm:py-14"
      aria-labelledby="featured-halls-heading"
      data-testid="featured-halls-section"
    >
      <Reveal>
        <div className="container-wesal">
          <div className="mx-auto max-w-[60rem]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl">
                <h2
                  id="featured-halls-heading"
                  className="wesal-section-heading text-[1.35rem] font-extrabold text-[var(--wesal-maroon)] sm:text-[1.7rem]"
                >
                  {t("home.providers.title")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--wesal-muted)] sm:text-[0.95rem]">
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
                      className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
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
                className="mt-5 rounded-2xl border-0 bg-white px-4 py-3 text-center shadow-[0_8px_20px_rgba(90,55,45,0.05)] sm:text-start"
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
                    setProsStatus("loading");
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
              <p className="mt-3 text-xs font-semibold text-[var(--wesal-muted)]" role="status">
                {t("home.featured.refreshing")}
              </p>
            ) : null}

            {sectionLoading ? (
              <div
                className="mt-7 grid gap-[1.15rem] sm:grid-cols-2 lg:grid-cols-3 lg:gap-5"
                data-testid="featured-halls-loading"
                aria-busy="true"
              >
                {Array.from({ length: 3 }).map((_, index) => (
                  <ProviderCardSkeleton key={index} />
                ))}
              </div>
            ) : null}

            {!sectionLoading && !hasPreview ? (
              <p className="mt-6 text-center text-sm text-[var(--wesal-muted)]" role="status">
                {filter === "halls"
                  ? t("home.featured.empty")
                  : t("home.providers.emptyCategory")}
              </p>
            ) : null}

            {!sectionLoading && hasPreview ? (
              <div
                className={`mt-7 grid items-stretch gap-[1.15rem] sm:grid-cols-2 lg:grid-cols-3 lg:gap-5${
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
                {previewProviders.map((provider, index) => (
                  <FeaturedProviderCard
                    key={`${provider.contentType}-${provider.id}`}
                    item={provider}
                    index={index}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-7 flex justify-center">
              <Link
                href={browseHref}
                className="inline-flex items-center gap-2.5 rounded-full border border-[var(--wesal-gold)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--wesal-gold)] transition-colors hover:bg-[var(--wesal-gold)] hover:text-white"
                data-testid="browse-more-halls"
              >
                {t("home.providers.browseHalls")}
                <ChevronIcon />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>

      {openHallId ? (
        <HallDetailsView hallId={openHallId} onClose={() => setOpenHallId(null)} />
      ) : null}
    </section>
  );
}

function FeaturedProviderCard({
  item,
  index,
}: {
  item: DiscoverItem;
  index: number;
}) {
  const t = useT();
  const href = discoverItemHref(item) ?? "/discover";
  const name =
    item.displayName?.trim() ||
    item.content?.trim() ||
    t("offers.card.untitled");
  const roleLabel =
    item.contentType === "Photographer"
      ? t("discover.type.Photographer")
      : t("discover.type.EventCoordinator");
  const location = item.location?.trim() || null;

  return (
    <article
      className="hall-card flex h-full flex-col overflow-hidden rounded-[0.95rem] border-0 bg-white shadow-[0_9px_24px_rgba(90,55,45,0.075)]"
      style={{ animationDelay: `${index * 90}ms` }}
      data-testid={`service-place-${item.id}`}
    >
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-[var(--wesal-pink)]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-extrabold text-[var(--wesal-maroon)]">
            {(name.charAt(0) || "?").toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col space-y-2 p-3.5 sm:p-4">
        <h3 className="text-[0.95rem] font-bold leading-snug text-[var(--wesal-maroon)] sm:text-base">
          {name}
        </h3>
        {location ? (
          <p className="text-[0.8rem] text-[var(--wesal-muted)] sm:text-sm">{location}</p>
        ) : null}
        <p className="text-[0.8rem] text-[var(--wesal-text)] sm:text-sm">{roleLabel}</p>
        <div className="mt-auto flex items-end justify-end pt-1">
          <Link
            href={href}
            className="hall-card-book btn-primary shrink-0 !min-h-9 !rounded-lg !bg-[var(--wesal-maroon-dark)] !px-3 !text-xs !font-bold hover:!bg-[#8a454b]"
            data-testid={`provider-inquire-${item.id}`}
          >
            {t("home.providers.inquire")}
          </Link>
        </div>
      </div>
    </article>
  );
}

function ProviderCardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-2xl border-0 bg-[var(--wesal-pink-soft)]"
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
