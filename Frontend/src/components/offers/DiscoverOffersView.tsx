"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DiscoverOfferCard from "@/components/offers/DiscoverOfferCard";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api-error";
import { fetchDiscoverFeed } from "@/services/discover";
import type { DiscoverFilter, DiscoverItem } from "@/types/offers";

const FILTERS: DiscoverFilter[] = [
  "All",
  "Halls",
  "EventCoordinators",
  "Photographers",
  "Offers",
];

const PAGE_SIZE = 12;

export default function DiscoverOffersView() {
  const t = useT();
  const searchParams = useSearchParams();
  const initialFilter = normalizeFilter(searchParams.get("filter"));
  const [filter, setFilter] = useState<DiscoverFilter>(initialFilter);
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async (nextFilter: DiscoverFilter, nextPage: number) => {
    setStatus("loading");
    setErrorKey(null);
    try {
      const result = await fetchDiscoverFeed(nextFilter, nextPage, PAGE_SIZE);
      setItems(result.items);
      setTotalPages(Math.max(1, result.totalPages));
      setTotalCount(result.totalCount);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setErrorKey(
        err instanceof ApiError ? err.message : "discover.errors.loadFailed",
      );
    }
  }, []);

  useEffect(() => {
    void load(filter, page);
  }, [filter, load, page]);

  useEffect(() => {
    const fromUrl = normalizeFilter(searchParams.get("filter"));
    setFilter(fromUrl);
    setPage(1);
  }, [searchParams]);

  const offerItems =
    filter === "Offers"
      ? items
      : items.filter(
          (item) =>
            item.contentType === "ProfessionalOffer" ||
            item.contentType === "HallOffer",
        );

  return (
    <div className="container-wesal py-6 sm:py-8" data-testid="discover-page">
      <header className="mb-5">
        <h1 className="text-xl font-extrabold text-[var(--wesal-maroon-dark)] sm:text-2xl">
          {t("discover.title")}
        </h1>
        <p className="mt-1 text-sm text-[var(--wesal-muted)]">
          {t("discover.subtitle")}
        </p>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
              filter === key
                ? "bg-[var(--wesal-maroon)] text-white"
                : "bg-white text-[var(--wesal-muted)] ring-1 ring-[var(--wesal-border)]"
            }`}
            onClick={() => {
              setFilter(key);
              setPage(1);
              const url = new URL(window.location.href);
              url.searchParams.set("filter", key);
              window.history.replaceState({}, "", url.toString());
            }}
          >
            {t(`discover.filter.${key}`)}
          </button>
        ))}
      </div>

      <p className="mb-4 text-sm font-bold text-[var(--wesal-maroon-dark)]">
        {t("discover.results", { count: totalCount })}
      </p>

      {status === "loading" ? (
        <p className="text-sm text-[var(--wesal-muted)]">{t("discover.loading")}</p>
      ) : null}
      {status === "error" ? (
        <p className="text-sm text-[#b42318]" role="alert">
          {errorKey?.startsWith("discover.") || errorKey?.startsWith("offers.")
            ? t(errorKey)
            : errorKey || t("discover.errors.loadFailed")}
        </p>
      ) : null}

      {status === "ready" && filter === "Offers" && offerItems.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--wesal-border)] bg-white p-8 text-center text-sm text-[var(--wesal-muted)]">
          {t("discover.emptyOffers")}
        </p>
      ) : null}

      {filter === "Offers" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {offerItems.map((item, index) => (
            <DiscoverOfferCard key={`${item.contentType}-${item.id}`} item={item} index={index} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <DiscoverGenericCard key={`${item.contentType}-${item.id}`} item={item} />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            className="btn-outline min-h-9 px-3 text-xs"
            disabled={page <= 1 || status === "loading"}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("discover.prev")}
          </button>
          <span className="text-xs text-[var(--wesal-muted)]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="btn-outline min-h-9 px-3 text-xs"
            disabled={page >= totalPages || status === "loading"}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {t("discover.next")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function DiscoverGenericCard({ item }: { item: DiscoverItem }) {
  const t = useT();
  const href = discoverItemHref(item);
  const body = (
    <>
      <div className="relative aspect-[4/3] bg-[var(--wesal-pink)]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="space-y-1 p-3">
        <p className="text-[0.65rem] font-bold uppercase text-[var(--wesal-maroon)]">
          {discoverTypeLabel(item.contentType, t)}
        </p>
        <h3 className="line-clamp-2 text-sm font-extrabold text-[var(--wesal-maroon-dark)]">
          {item.displayName || item.content || t("offers.card.untitled")}
        </h3>
        {item.location ? (
          <p className="text-xs text-[var(--wesal-muted)]">{item.location}</p>
        ) : null}
      </div>
    </>
  );

  if (!href) {
    return (
      <article className="overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white shadow-sm">
        {body}
      </article>
    );
  }

  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-2xl border border-[var(--wesal-border)] bg-white shadow-sm transition hover:shadow-md"
    >
      {body}
    </Link>
  );
}

function discoverItemHref(item: DiscoverItem): string | null {
  if (item.contentType === "Post") {
    return `/posts/${encodeURIComponent(item.id)}`;
  }
  if (
    (item.contentType === "EventCoordinator" ||
      item.contentType === "Photographer") &&
    item.ownerUserId
  ) {
    return `/professionals/${encodeURIComponent(item.ownerUserId)}`;
  }
  if (item.contentType === "Hall") {
    return `/halls/${encodeURIComponent(item.id)}`;
  }
  return null;
}

function discoverTypeLabel(
  contentType: string,
  t: (key: string) => string,
): string {
  const key = `discover.type.${contentType}`;
  const label = t(key);
  return label === key ? contentType : label;
}

function normalizeFilter(value: string | null): DiscoverFilter {
  const raw = (value ?? "Offers").trim();
  if (raw === "Coordinators") return "EventCoordinators";
  if (
    raw === "All" ||
    raw === "Halls" ||
    raw === "EventCoordinators" ||
    raw === "Photographers" ||
    raw === "Offers"
  ) {
    return raw;
  }
  return "Offers";
}
