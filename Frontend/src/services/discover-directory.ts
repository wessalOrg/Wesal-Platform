import { ApiError } from "@/lib/api-error";
import { fetchDiscoverFeed, searchDiscoverFeed } from "@/services/discover";
import type { DiscoverFilter, DiscoverItem, PagedOffers } from "@/types/offers";

const SOURCES = ["Halls", "EventCoordinators", "Photographers"] as const;
const TYPES = { Halls: "Hall", EventCoordinators: "EventCoordinator", Photographers: "Photographer" };
const SOURCE_SIZE = 50; // Backend maximum. Only fetch prefixes needed for the selected page.

export function directoryFilter(value: string | null): DiscoverFilter {
  if (value === "Coordinators" || value === "Event Coordinators") return "EventCoordinators";
  return SOURCES.some(source => source === value) ? value as DiscoverFilter : "All";
}

export function directoryItems(items: DiscoverItem[], filter: DiscoverFilter) {
  return items.filter(item => SOURCES.some(source => (filter === "All" || filter === source) && item.contentType === TYPES[source]));
}

/** Page-local/session-local cache; never shared with the posts/offers feed or another query. */
export function createDirectoryLoader(query: string) {
  const requests = new Map<string, Promise<PagedOffers<DiscoverItem>>>();
  function sourcePage(source: typeof SOURCES[number], page: number) {
    const key = `${source}:${page}`;
    let pending = requests.get(key);
    if (!pending) {
      pending = (query ? searchDiscoverFeed(query, source, page, SOURCE_SIZE)
        : fetchDiscoverFeed(source, page, SOURCE_SIZE)).catch(error => { requests.delete(key); throw error; });
      requests.set(key, pending);
    }
    return pending;
  }
  return async (filter: DiscoverFilter, page: number, size: number, current: () => boolean): Promise<PagedOffers<DiscoverItem>> => {
    if (filter !== "All") {
      const result = query ? await searchDiscoverFeed(query, filter, page, size) : await fetchDiscoverFeed(filter, page, size);
      return { ...result, items: directoryItems(result.items, filter) };
    }
    const sources = await Promise.all(SOURCES.map(async source => {
      const first = await sourcePage(source, 1);
      if (first.hasTotalCount === false) throw new ApiError("discover.errors.loadFailed", 0);
      const candidates = [...first.items];
      const needed = Math.min(first.totalPages, Math.ceil(page * size / SOURCE_SIZE));
      for (let number = 2; number <= needed && current(); number++) candidates.push(...(await sourcePage(source, number)).items);
      return { total: first.totalCount, items: directoryItems(candidates, source) };
    }));
    const totalCount = sources.reduce((sum, source) => sum + source.total, 0);
    const records = new Map(sources.flatMap(source => source.items).map(item => [`${item.contentType}:${item.id}`, item]));
    // Same ordering as DiscoverService.PageMixedAsync: date descending, type then ID ascending.
    const items = [...records.values()].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
      || a.contentType.localeCompare(b.contentType) || a.id.localeCompare(b.id));
    return { items: items.slice((page - 1) * size, page * size), pageNumber: page, pageSize: size,
      totalCount, totalPages: Math.ceil(totalCount / size), hasTotalCount: true };
  };
}
