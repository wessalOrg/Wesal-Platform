"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import CatalogHallCard from "@/components/halls/CatalogHallCard";
import HallsFilterBar from "@/components/halls/HallsFilterBar";
import { useHallFilters, hasActiveHallFilters, serializeHallFilters } from "@/hooks/useHallFilters";
import { usePublicHallsRevalidation } from "@/hooks/usePublicHallsRevalidation";
import { useT } from "@/i18n";
import { fetchCatalogHalls, fetchSearchHalls, filterCatalogHalls } from "@/services/halls";
import type { FeaturedHall } from "@/types/hall";

const HallDetailsView = dynamic(
  () => import("@/components/halls/HallDetailsView"),
  { ssr: false },
);

const PAGE_SIZE = 6;
const SEARCH_PAGE_SIZE = 50;
const PAGE_BTN_CLASS =
  "flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-[var(--wesal-gold)]/60 bg-[var(--wesal-maroon)]/25 text-sm font-bold text-[var(--wesal-maroon)] shadow-[0_8px_22px_rgba(193,123,127,0.18)] transition hover:border-[var(--wesal-gold)] hover:bg-[var(--wesal-maroon)] hover:text-white disabled:cursor-not-allowed disabled:border-[var(--wesal-gold)]/25 disabled:bg-white/40 disabled:text-[var(--wesal-maroon)]/35 disabled:shadow-none";
const PAGE_NUM_ACTIVE_CLASS =
  "flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-[var(--wesal-maroon)] bg-[var(--wesal-maroon)] text-sm font-bold text-white shadow-[0_8px_22px_rgba(193,123,127,0.22)]";

function getPageItems(pageCount: number, current: number): (number | "ellipsis")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }

  const items: (number | "ellipsis")[] = [0];
  const start = Math.max(1, current - 1);
  const end = Math.min(pageCount - 2, current + 1);

  if (start > 1) items.push("ellipsis");
  for (let index = start; index <= end; index += 1) items.push(index);
  if (end < pageCount - 2) items.push("ellipsis");
  items.push(pageCount - 1);
  return items;
}

export default function HallsCatalogView() {
  const t = useT();
  const {
    filters,
    detailedDraft,
    addresses,
    hasActiveFilters,
    setRegion,
    setAddress,
    setDetailedAddress,
    resetFilters,
  } = useHallFilters();
  const [halls, setHalls] = useState<FeaturedHall[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"catalog" | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const { region, address, detailedAddress } = filters;
  const filterKey = serializeHallFilters(filters);
  const [paging, setPaging] = useState({ key: filterKey, page: 0 });
  if (paging.key !== filterKey) {
    setPaging({ key: filterKey, page: 0 });
  }
  const page = paging.key === filterKey ? paging.page : 0;
  const setPage = (nextPage: number) => {
    setPaging({ key: filterKey, page: nextPage });
  };
  const [openHallId, setOpenHallId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  const requestRevalidate = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  usePublicHallsRevalidation(requestRevalidate);

  useEffect(() => {
    let active = true;
    if (isFirstLoad.current) {
      setStatus("loading");
    } else {
      setIsRefreshing(true);
    }

    const useSearch = hasActiveHallFilters({ region, address, detailedAddress });

    void (async () => {
      const result = useSearch
        ? await fetchSearchHalls({
            region,
            address,
            detailedAddress,
            pageSize: SEARCH_PAGE_SIZE,
          })
        : await fetchCatalogHalls();

      const resolved =
        useSearch && result.source !== "api" ? await fetchCatalogHalls() : result;

      if (!active) return;
      isFirstLoad.current = false;

      setHalls(resolved.halls);
      if (resolved.source === "api") {
        setError(null);
        setErrorKind(null);
      } else {
        setError(resolved.error ?? t("halls.catalog.connectionError"));
        setErrorKind("catalog");
      }

      setStatus("ready");
      setIsRefreshing(false);
    })();

    return () => {
      active = false;
    };
  }, [address, detailedAddress, region, reloadKey, t]);

  const filtered = useMemo(
    () => filterCatalogHalls(halls, { region, address, detailedAddress }),
    [halls, region, address, detailedAddress],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );
  const hasPrev = safePage > 0;
  const hasNext = safePage < pageCount - 1;

  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="container-wesal py-8 sm:py-10" data-testid="halls-catalog">
      <HallsFilterBar
        region={filters.region}
        address={filters.address}
        detailedAddress={detailedDraft}
        addresses={addresses}
        hasActiveFilters={hasActiveFilters}
        onRegionChange={setRegion}
        onAddressChange={setAddress}
        onDetailedAddressChange={setDetailedAddress}
        onReset={resetFilters}
      />

      <div className="mt-8 flex flex-wrap items-center justify-end gap-4 sm:mt-10">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--wesal-maroon)]">
          {status === "loading" || isRefreshing ? (
            <>
              <Spinner />
              {status === "loading"
                ? t("halls.catalog.loading")
                : t("halls.catalog.updating")}
            </>
          ) : (
            t("halls.catalog.found", { count: filtered.length })
          )}
        </p>
      </div>

      {error && errorKind ? (
        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-3 text-sm text-[var(--wesal-text)]"
          data-testid="halls-catalog-error"
          role="alert"
        >
          <p>
            {t("halls.catalog.offline")}
            {error ? ` (${error})` : ""}
          </p>
          <button
            type="button"
            className="btn-outline"
            data-testid="halls-catalog-retry"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            {t("common.retry")}
          </button>
        </div>
      ) : null}

      {isRefreshing && status === "ready" ? (
        <div
          className="mt-4 flex items-center gap-2 text-sm font-medium text-[var(--wesal-maroon)]"
          data-testid="halls-search-loading"
          role="status"
          aria-live="polite"
        >
          <Spinner />
          {t("halls.catalog.updating")}
        </div>
      ) : null}

      {status === "loading" ? (
        <div
          className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="halls-catalog-loading"
          aria-busy="true"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
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
          ))}
        </div>
      ) : null}

      {status === "ready" && visible.length > 0 ? (
        <div
          ref={gridRef}
          className={`mt-6 grid scroll-mt-24 gap-5 sm:grid-cols-2 lg:grid-cols-3 ${
            isRefreshing ? "pointer-events-none opacity-60" : ""
          }`}
          aria-busy={isRefreshing}
        >
          {visible.map((hall, index) => (
            <CatalogHallCard
              key={hall.id}
              hall={hall}
              index={safePage * PAGE_SIZE + index}
              showBookButton
              onOpen={() => setOpenHallId(hall.id)}
            />
          ))}
        </div>
      ) : null}

      {status === "ready" && visible.length === 0 ? (
        <div
          className="mt-10 rounded-2xl border border-[var(--wesal-border)] bg-white px-6 py-10 text-center"
          data-testid="halls-search-empty"
        >
          <p className="font-semibold text-[var(--wesal-text)]">
            {hasActiveFilters
              ? t("halls.catalog.emptyLocation")
              : t("halls.catalog.emptyApproved")}
          </p>
          {hasActiveFilters ? null : (
            <p className="mt-2 text-sm text-[var(--wesal-muted)]">
              {t("halls.catalog.emptyLaterHint")}
            </p>
          )}
          {hasActiveFilters ? (
            <button
              type="button"
              className="btn-outline mt-5"
              onClick={resetFilters}
            >
              {t("halls.catalog.resetFilters")}
            </button>
          ) : null}
        </div>
      ) : null}

      {status === "ready" && pageCount > 1 ? (
        <nav
          className="mt-10 flex items-center justify-center gap-2 pb-4 sm:gap-3"
          aria-label={t("halls.catalog.pagination")}
        >
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => goToPage(safePage - 1)}
            data-testid="halls-prev-page"
            aria-label={t("halls.catalog.prevPage")}
            className={PAGE_BTN_CLASS}
          >
            <Chevron dir="right" />
          </button>
          {getPageItems(pageCount, safePage).map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="flex h-12 w-8 items-center justify-center text-[var(--wesal-maroon)]"
                aria-hidden="true"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => goToPage(item)}
                aria-label={`${item + 1}`}
                aria-current={item === safePage ? "page" : undefined}
                data-testid={`halls-page-${item + 1}`}
                className={
                  item === safePage ? PAGE_NUM_ACTIVE_CLASS : PAGE_BTN_CLASS
                }
              >
                {item + 1}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={!hasNext}
            onClick={() => goToPage(safePage + 1)}
            data-testid="halls-next-page"
            aria-label={t("halls.catalog.nextPage")}
            className={PAGE_BTN_CLASS}
          >
            <Chevron dir="left" />
          </button>
        </nav>
      ) : null}

      {openHallId ? (
        <HallDetailsView hallId={openHallId} onClose={() => setOpenHallId(null)} />
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.4"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={dir === "left" ? "M14.5 6.5 9 12l5.5 5.5" : "M9.5 6.5 15 12l-5.5 5.5"}
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
