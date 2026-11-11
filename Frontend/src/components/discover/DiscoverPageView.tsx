"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DiscoverEmptyState from "@/components/discover/DiscoverEmptyState";
import DiscoverExploreGrid from "@/components/discover/DiscoverExploreGrid";
import DiscoverFilterTabs from "@/components/discover/DiscoverFilterTabs";
import DiscoverSearchBox from "@/components/discover/DiscoverSearchBox";
import { useFavoritePostIds } from "@/hooks/useFavoritePostIds";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import {
  filterVisibleDiscoverItems,
  normalizeDiscoverFilter,
} from "@/lib/discover-filter";
import {
  fetchDiscoverFeed,
  searchDiscoverFeed,
} from "@/services/discover";
import type { DiscoverFilter, DiscoverItem } from "@/types/offers";

const PAGE_SIZE = 12;

/**
 * Section 18–19 Discover page: filter tabs, context search, mixed explore grid.
 * Default filter is All. Search uses GET /search (Offers uses client filter on feed).
 */
export default function DiscoverPageView() {
  const t = useT();
  const searchParams = useSearchParams();
  const { ids: savedPostIds, markSaved } = useFavoritePostIds();
  const [filter, setFilter] = useState<DiscoverFilter>(() =>
    normalizeDiscoverFilter(searchParams.get("filter")),
  );
  const [draftQuery, setDraftQuery] = useState(
    () => searchParams.get("q")?.trim() ?? "",
  );
  const [appliedQuery, setAppliedQuery] = useState(
    () => searchParams.get("q")?.trim() ?? "",
  );
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "loading",
  );
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(
    () => Boolean(searchParams.get("q")?.trim()),
  );

  const syncUrl = useCallback((nextFilter: DiscoverFilter, nextQuery: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("filter", nextFilter);
    if (nextQuery.trim()) url.searchParams.set("q", nextQuery.trim());
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const load = useCallback(
    async (
      nextFilter: DiscoverFilter,
      nextPage: number,
      nextQuery: string,
      searched: boolean,
    ) => {
      setStatus("loading");
      setErrorKey(null);
      try {
        const term = nextQuery.trim();
        let result;

        if (term && nextFilter === "Offers") {
          // Search API rejects Offers — page through the active Offers feed and match locally.
          const matched = await collectMatchingOffers(term);
          result = {
            items: matched.slice((nextPage - 1) * PAGE_SIZE, nextPage * PAGE_SIZE),
            pageNumber: nextPage,
            pageSize: PAGE_SIZE,
            totalCount: matched.length,
            totalPages: Math.max(1, Math.ceil(matched.length / PAGE_SIZE) || 1),
          };
        } else if (term) {
          result = await searchDiscoverFeed(term, nextFilter, nextPage, PAGE_SIZE);
        } else if (searched && !term) {
          result = {
            items: [] as DiscoverItem[],
            pageNumber: 1,
            pageSize: PAGE_SIZE,
            totalCount: 0,
            totalPages: 0,
          };
        } else {
          // Browse feed (All default) without requiring a query first.
          result = await fetchDiscoverFeed(nextFilter, nextPage, PAGE_SIZE);
        }

        const visible = filterVisibleDiscoverItems(result.items);
        setItems(visible);
        // Prefer local visible count when client-side expiry removed rows.
        const total =
          visible.length < result.items.length
            ? Math.max(0, result.totalCount - (result.items.length - visible.length))
            : result.totalCount;
        setTotalPages(Math.max(1, result.totalPages));
        setTotalCount(total);
        setStatus("ready");
      } catch (err) {
        setItems([]);
        setStatus("error");
        setErrorKey(
          err instanceof ApiError ? err.message : "discover.errors.loadFailed",
        );
      }
    },
    [],
  );

  useEffect(() => {
    void load(filter, page, appliedQuery, hasSearched);
  }, [appliedQuery, filter, hasSearched, load, page]);

  useEffect(() => {
    const fromUrl = normalizeDiscoverFilter(searchParams.get("filter"));
    const q = searchParams.get("q")?.trim() ?? "";
    const offerId = searchParams.get("offer")?.trim() ?? "";
    const nextFilter = offerId ? "Offers" : fromUrl;
    setFilter(nextFilter);
    setDraftQuery(q);
    setAppliedQuery(q);
    setHasSearched(Boolean(q));
    setPage(1);
    if (offerId && fromUrl !== "Offers") {
      syncUrl("Offers", q);
    }
  }, [searchParams, syncUrl]);

  // Scroll/highlight a deep-linked offer card after the Offers feed loads.
  useEffect(() => {
    const offerId = searchParams.get("offer")?.trim();
    if (!offerId || status !== "ready" || filter !== "Offers") return;
    const node = document.getElementById(`discover-offer-${offerId}`);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.classList.add("ring-2", "ring-[var(--wesal-maroon)]");
    const timer = window.setTimeout(() => {
      node.classList.remove("ring-2", "ring-[var(--wesal-maroon)]");
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [filter, items, searchParams, status]);

  function changeFilter(next: DiscoverFilter) {
    setFilter(next);
    setPage(1);
    syncUrl(next, appliedQuery);
  }

  function submitSearch() {
    const term = draftQuery.trim();
    setAppliedQuery(term);
    setHasSearched(true);
    setPage(1);
    syncUrl(filter, term);
  }

  function clearSearch() {
    setDraftQuery("");
    setAppliedQuery("");
    setHasSearched(false);
    setPage(1);
    syncUrl(filter, "");
  }

  const emptyVariant =
    status === "loading"
      ? "loading"
      : status === "ready" && items.length === 0
        ? appliedQuery || hasSearched
          ? "noResults"
          : "idle"
        : null;

  return (
    <div className="pb-10" data-testid="discover-page">
      <section className="border-b border-[color-mix(in_srgb,var(--wesal-maroon)_10%,transparent)] bg-[linear-gradient(120deg,color-mix(in_srgb,var(--wesal-maroon)_10%,white),var(--wesal-pink-soft)_55%,#fff8f4)]">
        <div className="container-wesal py-8 sm:py-10">
          <div className="mb-6 flex flex-col items-center gap-3 text-center sm:mb-8">
            <div className="flex items-center gap-2">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-[var(--wesal-maroon)] shadow-sm"
                aria-hidden="true"
              >
                <HeroSearchIcon />
              </span>
              <div className="text-start">
                <h1 className="text-xl font-extrabold text-[var(--wesal-maroon-dark)] sm:text-2xl">
                  {t("discover.hero.title")}
                </h1>
                <p className="text-sm text-[var(--wesal-muted)]">
                  {t("discover.hero.subtitle")}
                </p>
              </div>
            </div>
          </div>

          <DiscoverSearchBox
            filter={filter}
            value={draftQuery}
            busy={status === "loading"}
            onChange={setDraftQuery}
            onSubmit={submitSearch}
            onClear={clearSearch}
          />
        </div>
      </section>

      <div className="container-wesal pt-5 sm:pt-6">
        <DiscoverFilterTabs value={filter} onChange={changeFilter} />

        {status === "ready" && items.length > 0 ? (
          <p className="mb-4 mt-5 text-center text-sm font-bold text-[var(--wesal-maroon-dark)]">
            {t("discover.resultsFound", { count: totalCount })}
          </p>
        ) : (
          <div className="mt-5" />
        )}

        {status === "error" ? (
          <div
            className="rounded-[1.15rem] border border-[#f5c6c2] bg-[#fdecea] p-5 text-center"
            role="alert"
          >
            <p className="text-sm text-[#b42318]">
              {errorKey?.startsWith("discover.") || errorKey?.startsWith("errors.")
                ? t(errorKey)
                : errorKey || t("discover.errors.loadFailed")}
            </p>
            <button
              type="button"
              className="btn-outline mt-3"
              onClick={() => void load(filter, page, appliedQuery, hasSearched)}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : null}

        {emptyVariant ? (
          <DiscoverEmptyState
            variant={emptyVariant}
            onClear={
              emptyVariant === "noResults" ? clearSearch : undefined
            }
          />
        ) : null}

        {status === "ready" && items.length > 0 ? (
          <>
            <DiscoverExploreGrid
              filter={filter}
              items={items}
              savedPostIds={savedPostIds}
              onFavoriteChanged={markSaved}
            />
            {totalPages > 1 ? (
              <nav
                className="mt-8 flex items-center justify-center gap-1.5"
                aria-label={t("discover.pagination")}
              >
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--wesal-border)] text-[var(--wesal-muted)] disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label={t("discover.prev")}
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(
                  (n) => (
                    <button
                      key={n}
                      type="button"
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${
                        n === page
                          ? "bg-[var(--wesal-maroon)] text-white"
                          : "border border-[var(--wesal-border)] text-[var(--wesal-muted)]"
                      }`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--wesal-border)] text-[var(--wesal-muted)] disabled:opacity-40"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label={t("discover.next")}
                >
                  ›
                </button>
              </nav>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

const OFFERS_SEARCH_PAGE_SIZE = 50;
const OFFERS_SEARCH_MAX_PAGES = 10;

async function collectMatchingOffers(term: string): Promise<DiscoverItem[]> {
  const needle = term.trim().toLowerCase();
  if (!needle) return [];
  const matched: DiscoverItem[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages && page <= OFFERS_SEARCH_MAX_PAGES) {
    const feed = await fetchDiscoverFeed("Offers", page, OFFERS_SEARCH_PAGE_SIZE);
    totalPages = Math.max(1, feed.totalPages);
    for (const item of filterVisibleDiscoverItems(feed.items)) {
      const hay =
        `${item.displayName ?? ""} ${item.content ?? ""} ${item.location ?? ""}`.toLowerCase();
      if (hay.includes(needle)) matched.push(item);
    }
    if (feed.items.length === 0) break;
    page += 1;
  }
  return matched;
}

function HeroSearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
