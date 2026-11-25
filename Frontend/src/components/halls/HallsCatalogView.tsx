"use client";

import { useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import CatalogHallCard from "@/components/halls/CatalogHallCard";
import HallsFilterBar from "@/components/halls/HallsFilterBar";
import { useHallFilters, serializeHallFilters } from "@/hooks/useHallFilters";
import { usePublicHallsRevalidation } from "@/hooks/usePublicHallsRevalidation";
import { useT } from "@/i18n";
import { useHallCatalogPage } from "@/hooks/useHallCatalogPage";
import { useUiLang } from "@/components/layout/LanguageProvider";

const HallDetailsView = dynamic(
  () => import("@/components/halls/HallDetailsView"),
  { ssr: false },
);

const PAGE_SIZE = 6;
const PAGE_BTN_CLASS =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[var(--wesal-gold)]/60 bg-[var(--wesal-maroon)]/25 text-xs font-bold text-[var(--wesal-maroon)] shadow-[0_6px_16px_rgba(193,123,127,0.16)] transition hover:border-[var(--wesal-gold)] hover:bg-[var(--wesal-maroon)] hover:text-white disabled:cursor-not-allowed disabled:border-[var(--wesal-gold)]/25 disabled:bg-white/40 disabled:text-[var(--wesal-maroon)]/35 disabled:shadow-none sm:h-10 sm:w-10 sm:text-sm";
const PAGE_NUM_ACTIVE_CLASS =
  "flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[var(--wesal-maroon)] bg-[var(--wesal-maroon)] text-xs font-bold text-white shadow-[0_6px_16px_rgba(193,123,127,0.2)] sm:h-10 sm:w-10 sm:text-sm";

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
  const lang = useUiLang();
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
  const [reloadKey, setReloadKey] = useState(0);
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

  const requestRevalidate = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  usePublicHallsRevalidation(requestRevalidate);

  const { halls: visible, pagination, error: hasError, loading, refreshing: isRefreshing, ready } =
    useHallCatalogPage(filters, page + 1, PAGE_SIZE, reloadKey);
  const status = loading ? "loading" : ready ? "ready" : "error";
  const error = hasError ? t("halls.catalog.connectionError") : null;
  const pageCount = Math.max(1, pagination?.totalPages ?? 0);
  // A refresh can remove the current last page. Request the new last page once.
  if (pagination && ready && !isRefreshing && page >= pageCount) setPage(pageCount - 1);
  const safePage = page;
  const hasPrev = page > 0;
  const hasNext = page + 1 < pageCount;

  const goToPage = (nextPage: number) => {
    if (nextPage === page) return;
    setPage(nextPage);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="container-wesal py-5 sm:py-7" data-testid="halls-catalog">
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

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3 sm:mt-6">
        <p aria-live="polite" className="inline-flex items-center gap-2 text-xs font-medium text-[var(--wesal-maroon)] sm:text-sm">
          {status === "loading" || isRefreshing ? (
            <>
              <Spinner />
              {status === "loading"
                ? t("halls.catalog.loading")
                : t("halls.catalog.updating")}
            </>
          ) : (
            pagination ? t("halls.catalog.found", { count: pagination.totalCount }) : null
          )}
        </p>
      </div>

      {error ? (
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
          className="mt-4 grid gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3"
          data-testid="halls-catalog-loading"
          aria-busy="true"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)]"
              aria-hidden="true"
            >
              <div className="aspect-[3/2] animate-pulse bg-[var(--wesal-pink)]" />
              <div className="space-y-2 p-3">
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-[rgba(193,123,127,0.18)]" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-[rgba(193,123,127,0.12)]" />
                <div className="h-2.5 w-3/5 animate-pulse rounded bg-[rgba(193,123,127,0.12)]" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {status === "ready" && visible.length > 0 ? (
        <div
          ref={gridRef}
          className={`mt-4 grid scroll-mt-24 gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 ${
            isRefreshing ? "pointer-events-none opacity-60" : ""
          }`}
          aria-busy={isRefreshing}
        >
          {visible.map((hall, index) => (
            <CatalogHallCard
              key={hall.id}
              hall={hall}
              index={index}
              showBookButton
              compact
              onOpen={() => setOpenHallId(hall.id)}
            />
          ))}
        </div>
      ) : null}

      {status === "ready" && !error && visible.length === 0 ? (
        <div
          className="mt-7 rounded-xl border border-[var(--wesal-border)] bg-white px-5 py-8 text-center"
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

      {pagination && pageCount > 1 ? (
        <nav
          className="mt-7 flex items-center justify-center gap-1.5 pb-3 sm:mt-8 sm:gap-2"
          aria-label={t("halls.catalog.pagination")}
          aria-busy={loading || isRefreshing}
        >
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => goToPage(safePage - 1)}
            data-testid="halls-prev-page"
            aria-label={t("halls.catalog.prevPage")}
            className={PAGE_BTN_CLASS}
          >
            <Chevron dir={lang === "ar" ? "right" : "left"} />
          </button>
          {getPageItems(pageCount, safePage).map((item, index) =>
            item === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                className="flex h-9 w-7 items-center justify-center text-[var(--wesal-maroon)] sm:h-10"
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
            <Chevron dir={lang === "ar" ? "left" : "right"} />
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
