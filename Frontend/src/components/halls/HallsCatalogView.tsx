"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import FieldSelect from "@/components/ui/FieldSelect";
import CatalogHallCard, { isHallOpen } from "@/components/halls/CatalogHallCard";
import {
  fetchCatalogHalls,
  fetchSearchHalls,
  filterCatalogHalls,
  getPastSearchDateMessage,
} from "@/services/halls";
import {
  REGION_OPTIONS,
  type FeaturedHall,
  type HallBookingPeriodFilter,
  type HallRegion,
} from "@/types/hall";

const HallDetailsView = dynamic(
  () => import("@/components/halls/HallDetailsView"),
  { ssr: false },
);

type SortFilter = "all" | "top" | "open" | "closed";

type SearchDraft = {
  name: string;
  area: string;
  date: string;
  region: HallRegion;
  period: HallBookingPeriodFilter;
};

const EMPTY_SEARCH: SearchDraft = {
  name: "",
  area: "",
  date: "",
  region: "all",
  period: "all",
};

const FIELD_CLASS =
  "mt-1.5 h-11 w-full rounded-xl border border-[var(--wesal-border)] bg-[#faf7f5] px-3 text-sm font-medium text-[var(--wesal-text)] outline-none focus:border-[var(--wesal-maroon)]";

const PERIOD_OPTIONS: { id: HallBookingPeriodFilter; label: string }[] = [
  { id: "all", label: "كل الفترات" },
  { id: "first", label: "الفترة الأولى" },
  { id: "second", label: "الفترة الثانية" },
];
const PAGE_SIZE = 6;
const PAGE_BTN_CLASS =
  "flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-[var(--wesal-gold)]/60 bg-[var(--wesal-maroon)]/25 text-sm font-bold text-[var(--wesal-maroon)] shadow-[0_8px_22px_rgba(193,123,127,0.18)] transition hover:border-[var(--wesal-gold)] hover:bg-[var(--wesal-maroon)] hover:text-white disabled:cursor-not-allowed disabled:border-[var(--wesal-gold)]/25 disabled:bg-white/40 disabled:text-[var(--wesal-maroon)]/35 disabled:shadow-none";
const PAGE_NUM_ACTIVE_CLASS =
  "flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-[var(--wesal-maroon)] bg-[var(--wesal-maroon)] text-sm font-bold text-white shadow-[0_8px_22px_rgba(193,123,127,0.22)]";

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

function isHallRegion(value: string): value is HallRegion {
  return REGION_OPTIONS.some((option) => option.id === value);
}

function parseFiltersFromQuery(params: URLSearchParams): SearchDraft {
  const region = params.get("region") ?? "all";
  const period = params.get("period") ?? "all";
  return {
    name: params.get("name") ?? "",
    area: params.get("area") ?? "",
    date: params.get("date") ?? "",
    region: isHallRegion(region) ? region : "all",
    period: period === "first" || period === "second" ? period : "all",
  };
}

function serializeFiltersToQuery(filters: SearchDraft): string {
  const params = new URLSearchParams();
  if (filters.name.trim()) params.set("name", filters.name.trim());
  if (filters.area.trim()) params.set("area", filters.area.trim());
  if (filters.date.trim()) params.set("date", filters.date.trim());
  if (filters.region !== "all") params.set("region", filters.region);
  if (filters.period !== "all") params.set("period", filters.period);
  return params.toString();
}

function isSearchActive(filters: SearchDraft): boolean {
  return (
    Boolean(filters.name.trim()) ||
    Boolean(filters.area.trim()) ||
    Boolean(filters.date.trim()) ||
    filters.region !== "all" ||
    filters.period !== "all"
  );
}

export default function HallsCatalogView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<SearchDraft>(() =>
    parseFiltersFromQuery(searchParams),
  );
  const [halls, setHalls] = useState<FeaturedHall[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"catalog" | "search" | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [sort, setSort] = useState<SortFilter>("all");
  const filterKey = `${serializeFiltersToQuery(filters)}|${sort}`;
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

  const queryString = searchParams.toString();

  useEffect(() => {
    const fromUrl = parseFiltersFromQuery(new URLSearchParams(queryString));
    // URL is an external store (back/forward); keep local filters in sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters((current) =>
      serializeFiltersToQuery(current) === serializeFiltersToQuery(fromUrl)
        ? current
        : fromUrl,
    );
  }, [queryString]);

  useEffect(() => {
    const nextQuery = serializeFiltersToQuery(filters);
    if (nextQuery === queryString) return;
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [filters, pathname, queryString, router]);

  useEffect(() => {
    let active = true;
    const delay = isFirstLoad.current ? 0 : 400;
    const timer = window.setTimeout(() => {
      const searching = isSearchActive(filters);
      if (isFirstLoad.current) {
        setStatus("loading");
      } else {
        setIsRefreshing(true);
      }

      const request =
        searching && !getPastSearchDateMessage(filters.date)
          ? fetchSearchHalls(filters)
          : fetchCatalogHalls();

      void request.then((result) => {
        if (!active) return;
        isFirstLoad.current = false;

        if (result.source === "api") {
          setHalls(result.halls);
          setError(null);
          setErrorKind(null);
        } else if (!searching) {
          setHalls(result.halls);
          setError(result.error ?? "تعذر الاتصال بالخادم.");
          setErrorKind("catalog");
        } else {
          setError(result.error ?? "تعذر تنفيذ البحث.");
          setErrorKind("search");
        }

        setStatus("ready");
        setIsRefreshing(false);
      });
    }, delay);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [filters, reloadKey]);

  const filtered = useMemo(() => {
    let next = filterCatalogHalls(halls, filters);

    if (sort === "top") {
      next = [...next].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sort === "open") {
      next = next.filter(isHallOpen);
    } else if (sort === "closed") {
      next = next.filter((hall) => !isHallOpen(hall));
    }

    return next;
  }, [halls, filters, sort]);

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

  const updateFilter = <K extends keyof SearchDraft>(
    key: K,
    value: SearchDraft[K],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const clearAllFilters = () => {
    setFilters(EMPTY_SEARCH);
    setSort("all");
    setReloadKey((key) => key + 1);
  };

  const hasActiveFilters = isSearchActive(filters);

  const clearChip = (key: keyof SearchDraft) => {
    setFilters((current) => ({ ...current, [key]: EMPTY_SEARCH[key] }));
  };

  const regionLabel =
    REGION_OPTIONS.find((option) => option.id === filters.region)?.label ?? "";
  const periodLabel =
    PERIOD_OPTIONS.find((option) => option.id === filters.period)?.label ?? "";
  const pastDateMessage = getPastSearchDateMessage(filters.date);

  return (
    <div className="container-wesal py-8 sm:py-10" data-testid="halls-catalog">
      <form
        className="overflow-visible rounded-3xl bg-white p-4 shadow-[0_12px_36px_rgba(90,55,45,0.08)] sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setReloadKey((key) => key + 1);
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
          <label className="block text-sm font-semibold text-[var(--wesal-maroon)]">
            الاسم
            <input
              value={filters.name}
              onChange={(event) => updateFilter("name", event.target.value)}
              placeholder="اسم الصالة"
              className={FIELD_CLASS}
            />
          </label>
          <label className="block text-sm font-semibold text-[var(--wesal-maroon)]">
            الحي
            <input
              value={filters.area}
              onChange={(event) => updateFilter("area", event.target.value)}
              placeholder="الرمال، النصر…"
              className={FIELD_CLASS}
            />
          </label>
          <label className="block text-sm font-semibold text-[var(--wesal-maroon)]">
            التاريخ
            <input
              type="text"
              inputMode="text"
              value={filters.date}
              onChange={(event) => updateFilter("date", event.target.value)}
              placeholder="يوم/شهر/سنة"
              className={FIELD_CLASS}
            />
          </label>
          <label className="block text-sm font-semibold text-[var(--wesal-maroon)]">
            المنطقة
            <FieldSelect
              aria-label="المنطقة"
              value={filters.region}
              options={REGION_OPTIONS.map((option) => ({
                id: option.id,
                label: option.id === "all" ? "اختيار المنطقة" : option.label,
              }))}
              onChange={(region) => updateFilter("region", region)}
            />
          </label>
          <label className="block text-sm font-semibold text-[var(--wesal-maroon)]">
            فترة الحجز
            <FieldSelect
              aria-label="فترة الحجز"
              value={filters.period}
              options={PERIOD_OPTIONS}
              onChange={(period) => updateFilter("period", period)}
            />
          </label>
          <button type="submit" className="btn-primary mt-6 h-11 gap-2 lg:mt-7">
            <SearchIcon />
            بحث
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {filters.name ? (
          <Chip label={filters.name} onClear={() => clearChip("name")} />
        ) : null}
        {filters.area ? (
          <Chip label={filters.area} onClear={() => clearChip("area")} />
        ) : null}
        {filters.date ? (
          <Chip label={filters.date} onClear={() => clearChip("date")} />
        ) : null}
        {filters.region !== "all" ? (
          <Chip label={regionLabel} onClear={() => clearChip("region")} />
        ) : null}
        {filters.period !== "all" ? (
          <Chip label={periodLabel} onClear={() => clearChip("period")} />
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="ترتيب القاعات">
          {(
            [
              { id: "all", label: "الكل" },
              { id: "top", label: "الأعلى تقييماً" },
              { id: "open", label: "صالات مفتوحة" },
              { id: "closed", label: "قاعات مغلقة" },
            ] as const
          ).map((option) => {
            const active = sort === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setSort(option.id);
                }}
                className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--wesal-maroon)] text-white"
                    : "border border-[var(--wesal-maroon)] bg-white text-[var(--wesal-maroon)] hover:bg-[var(--wesal-maroon)] hover:text-white"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--wesal-maroon)]">
          {status === "loading" || isRefreshing ? (
            <>
              <Spinner />
              {status === "loading" ? "جاري تحميل القاعات…" : "جاري تحديث النتائج…"}
            </>
          ) : (
            `تم العثور على ${filtered.length} صالة`
          )}
        </p>
      </div>

      {pastDateMessage ? (
        <div
          className="mt-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          data-testid="halls-past-date-warning"
          role="alert"
        >
          {pastDateMessage}
        </div>
      ) : null}

      {error && errorKind ? (
        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--wesal-border)] bg-[var(--wesal-pink-soft)] px-4 py-3 text-sm text-[var(--wesal-text)]"
          data-testid="halls-catalog-error"
          role="alert"
        >
          <p>
            {errorKind === "search"
              ? "تعذر تنفيذ البحث من الخادم. يتم التصفية محلياً."
              : "تعذر الاتصال بالخادم حالياً. يتم عرض قاعات تجريبية."}
            {error ? ` (${error})` : ""}
          </p>
          <button
            type="button"
            className="btn-outline"
            data-testid="halls-catalog-retry"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            إعادة المحاولة
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
          جاري جلب نتائج البحث…
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
          className={`mt-10 rounded-2xl border px-6 py-10 text-center ${
            pastDateMessage
              ? "border-red-200 bg-red-50"
              : "border-[var(--wesal-border)] bg-white"
          }`}
          data-testid="halls-search-empty"
        >
          <p
            className={`font-semibold ${
              pastDateMessage ? "text-red-700" : "text-[var(--wesal-text)]"
            }`}
          >
            {pastDateMessage
              ? "لا يمكن البحث بتاريخ مضى."
              : hasActiveFilters
                ? "لا توجد قاعات مطابقة لبحثك حالياً."
                : "لا توجد قاعات معتمدة حالياً."}
          </p>
          <p
            className={`mt-2 text-sm ${
              pastDateMessage ? "text-red-600" : "text-[var(--wesal-muted)]"
            }`}
          >
            {pastDateMessage
              ? "عدّلي التاريخ ليوم اليوم أو لتاريخ قادم ثم اضغطي بحث."
              : hasActiveFilters
                ? "جرّبي تخفيف الفلاتر (الاسم، المنطقة، التاريخ، أو الفترة)."
                : "عُد لاحقاً أو أعدّي المحاولة بعد قليل."}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              className="btn-outline mt-5"
              onClick={clearAllFilters}
            >
              مسح الفلاتر
            </button>
          ) : null}
        </div>
      ) : null}

      {status === "ready" && pageCount > 1 ? (
        <nav
          className="mt-10 flex items-center justify-center gap-2 pb-4 sm:gap-3"
          aria-label="ترقيم صفحات القاعات"
        >
          <button
            type="button"
            disabled={!hasPrev}
            onClick={() => goToPage(safePage - 1)}
            data-testid="halls-prev-page"
            aria-label="الصفحة السابقة"
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
                aria-label={`الصفحة ${item + 1}`}
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
            aria-label="الصفحة التالية"
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

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[var(--wesal-maroon)] px-3 py-1 text-xs font-semibold text-white"
    >
      {label}
      <span aria-hidden="true">×</span>
    </button>
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

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
