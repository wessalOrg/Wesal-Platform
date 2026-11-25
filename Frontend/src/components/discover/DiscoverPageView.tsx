"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DiscoverEmptyState from "@/components/discover/DiscoverEmptyState";
import DiscoverExploreGrid from "@/components/discover/DiscoverExploreGrid";
import DiscoverFilterTabs from "@/components/discover/DiscoverFilterTabs";
import DiscoverSearchBox from "@/components/discover/DiscoverSearchBox";
import { useRequestScope } from "@/hooks/useRequestScope";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { readAuthenticatedAccount, serverAuthenticatedAccount, subscribeAuthenticatedAccount } from "@/lib/authenticated-account";
import { createDirectoryLoader, directoryFilter, directoryItems } from "@/services/discover-directory";
import type { DiscoverFilter, DiscoverItem } from "@/types/offers";

const PAGE_SIZE = 12;

/** Public directory: halls, coordinators and photographers only. */
export default function DiscoverPageView() {
  const t = useT(), router = useRouter();
  const scope = useRequestScope();
  const searchParams = useSearchParams();
  const account = useSyncExternalStore(subscribeAuthenticatedAccount, readAuthenticatedAccount, serverAuthenticatedAccount);
  const [filter, setFilter] = useState<DiscoverFilter>(() => directoryFilter(searchParams.get("filter")));
  const [draftQuery, setDraftQuery] = useState(() => searchParams.get("q")?.trim() ?? "");
  const [appliedQuery, setAppliedQuery] = useState(() => searchParams.get("q")?.trim() ?? "");
  const [loadedItems, setItems] = useState<DiscoverItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [serverTotalCount, setTotalCount] = useState<number | null>(null);
  const [loadStatus, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(() => Boolean(searchParams.get("q")?.trim()));
  const legacyOffers = searchParams.get("filter") === "Offers" || Boolean(searchParams.get("offer")?.trim());
  const criteria = useMemo(() => ({ account, filter, page, appliedQuery, hasSearched }), [account, filter, page, appliedQuery, hasSearched]);
  const [resultCriteria, setResultCriteria] = useState<typeof criteria | null>(null);
  const directory = useMemo(() => ({ account, filter, read: createDirectoryLoader(appliedQuery) }), [account, filter, appliedQuery]);
  const status = resultCriteria === criteria ? loadStatus : "loading";
  const items = status === "ready" ? directoryItems(loadedItems, filter) : [];
  const totalCount = serverTotalCount ?? "\u2026";

  const syncUrl = useCallback((nextFilter: DiscoverFilter, nextQuery: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("filter", nextFilter);
    url.searchParams.delete("offer");
    if (nextQuery.trim()) url.searchParams.set("q", nextQuery.trim());
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const load = useCallback(async () => {
    const current = scope.latest("discover");
    if (!current() || legacyOffers) return;
    setStatus("loading"); setErrorKey(null);
    try {
      const result = hasSearched && !appliedQuery.trim()
        ? { items: [], totalPages: 0, totalCount: 0, hasTotalCount: true }
        : await directory.read(filter, page, PAGE_SIZE, current);
      if (!current()) return;
      const lastPage = Math.max(1, result.totalPages);
      if (page > lastPage) { setPage(lastPage); return; }
      setItems(result.items); setTotalPages(lastPage);
      setTotalCount(result.hasTotalCount === false ? null : result.totalCount);
      setResultCriteria(criteria); setStatus("ready");
    } catch (error) {
      if (!current()) return;
      setItems([]); setResultCriteria(criteria); setStatus("error");
      setErrorKey(error instanceof ApiError ? error.message : "discover.errors.loadFailed");
    }
  }, [scope, criteria, directory, filter, page, appliedQuery, hasSearched, legacyOffers]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => { window.clearTimeout(timer); scope.latest("discover"); };
  }, [load, scope]);

  const fromUrl = directoryFilter(searchParams.get("filter"));
  const urlQuery = searchParams.get("q")?.trim() ?? "";
  const urlKey = JSON.stringify([fromUrl, urlQuery]);
  const [seenUrl, setSeenUrl] = useState(urlKey);
  if (seenUrl !== urlKey) {
    setSeenUrl(urlKey); setFilter(fromUrl); setDraftQuery(urlQuery);
    setAppliedQuery(urlQuery); setHasSearched(Boolean(urlQuery)); setPage(1);
  }
  useEffect(() => {
    if (legacyOffers) router.replace("/posts-and-offers");
  }, [legacyOffers, router]);

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
              onClick={() => void load()}
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
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => Math.max(1, Math.min(page - 2, totalPages - 4)) + i).map(
                  (n) => (
                    <button
                      key={n}
                      type="button"
                      className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold ${
                        n === page
                          ? "bg-[var(--wesal-maroon)] text-white"
                          : "border border-[var(--wesal-border)] text-[var(--wesal-muted)]"
                      }`}
                      aria-current={n === page ? "page" : undefined}
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

function HeroSearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
