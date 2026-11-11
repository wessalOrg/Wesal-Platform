import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { resolveOfferMediaUrl } from "@/lib/offer-format";
import type {
  DiscoverFilter,
  DiscoverItem,
  PagedOffers,
} from "@/types/offers";

export const DISCOVER_PATH = "/discover";

type ApiDiscoverItem = {
  contentType?: string;
  ContentType?: string;
  id?: string;
  Id?: string;
  hallId?: string | null;
  HallId?: string | null;
  ownerUserId?: string | null;
  OwnerUserId?: string | null;
  displayName?: string | null;
  DisplayName?: string | null;
  content?: string | null;
  Content?: string | null;
  imageUrl?: string | null;
  ImageUrl?: string | null;
  location?: string | null;
  Location?: string | null;
  price?: number | null;
  Price?: number | null;
  oldPrice?: number | null;
  OldPrice?: number | null;
  offerPrice?: number | null;
  OfferPrice?: number | null;
  startsAt?: string | null;
  StartsAt?: string | null;
  endsAt?: string | null;
  EndsAt?: string | null;
  stoppedAt?: string | null;
  StoppedAt?: string | null;
  createdAt?: string;
  CreatedAt?: string;
};

type ApiPaged = {
  items?: ApiDiscoverItem[] | null;
  Items?: ApiDiscoverItem[] | null;
  pageNumber?: number;
  PageNumber?: number;
  pageSize?: number;
  PageSize?: number;
  totalCount?: number;
  TotalCount?: number;
  totalPages?: number;
  TotalPages?: number;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function mapDiscoverItem(
  raw: ApiDiscoverItem | null | undefined,
): DiscoverItem | null {
  if (!raw || typeof raw !== "object") return null;
  const id = asText(raw.id ?? raw.Id);
  const contentType = asText(raw.contentType ?? raw.ContentType);
  const createdAt = asText(raw.createdAt ?? raw.CreatedAt);
  if (!id || !contentType) return null;
  return {
    contentType,
    id,
    hallId: asText(raw.hallId ?? raw.HallId) || null,
    ownerUserId: asText(raw.ownerUserId ?? raw.OwnerUserId) || null,
    displayName: asText(raw.displayName ?? raw.DisplayName) || null,
    content: asText(raw.content ?? raw.Content) || null,
    imageUrl: resolveOfferMediaUrl(asText(raw.imageUrl ?? raw.ImageUrl)) || null,
    location: asText(raw.location ?? raw.Location) || null,
    price: asNumber(raw.price ?? raw.Price),
    oldPrice: asNumber(raw.oldPrice ?? raw.OldPrice),
    offerPrice: asNumber(raw.offerPrice ?? raw.OfferPrice),
    startsAt: asText(raw.startsAt ?? raw.StartsAt) || null,
    endsAt: asText(raw.endsAt ?? raw.EndsAt) || null,
    stoppedAt: asText(raw.stoppedAt ?? raw.StoppedAt) || null,
    createdAt: createdAt || new Date(0).toISOString(),
  };
}

function mapPaged(data: ApiPaged | null | undefined): PagedOffers<DiscoverItem> {
  const rows = data?.items ?? data?.Items ?? [];
  const items = Array.isArray(rows)
    ? rows.map(mapDiscoverItem).filter((row): row is DiscoverItem => Boolean(row))
    : [];
  const pageNumber = asNumber(data?.pageNumber ?? data?.PageNumber) ?? 1;
  const pageSize = asNumber(data?.pageSize ?? data?.PageSize) ?? items.length;
  const totalCount = asNumber(data?.totalCount ?? data?.TotalCount) ?? items.length;
  const totalPages =
    asNumber(data?.totalPages ?? data?.TotalPages) ??
    (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0);
  return { items, pageNumber, pageSize, totalCount, totalPages };
}

export const SEARCH_PATH = "/search";

/** Maps UI filter to API filter query value. */
export function toDiscoverApiFilter(filter: DiscoverFilter): string {
  if (filter === "Coordinators" || filter === "EventCoordinators") {
    return "EventCoordinators";
  }
  return filter;
}

/** GET /discover?filter=&page=&pageSize= */
export async function fetchDiscoverFeed(
  filter: DiscoverFilter = "All",
  page = 1,
  pageSize = 12,
): Promise<PagedOffers<DiscoverItem>> {
  try {
    const { data } = await api.get<ApiPaged>(DISCOVER_PATH, {
      params: { filter: toDiscoverApiFilter(filter), page, pageSize },
      timeout: 15000,
    });
    return mapPaged(data);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "discover.errors.loadFailed",
      0,
    );
  }
}

/**
 * GET /search?query=&filter=&page=&pageSize=
 * Name search for All / Halls / Coordinators / Photographers (Offers not accepted).
 */
export async function searchDiscoverFeed(
  query: string,
  filter: DiscoverFilter = "All",
  page = 1,
  pageSize = 12,
): Promise<PagedOffers<DiscoverItem>> {
  const term = query.trim();
  if (!term) {
    return { items: [], pageNumber: page, pageSize, totalCount: 0, totalPages: 0 };
  }
  const apiFilter = toDiscoverApiFilter(filter);
  if (apiFilter === "Offers") {
    throw new ApiError("discover.errors.searchOffersUnsupported", 422);
  }
  try {
    const { data } = await api.get<ApiPaged>(SEARCH_PATH, {
      params: { query: term, filter: apiFilter, page, pageSize },
      timeout: 15000,
    });
    return mapPaged(data);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "discover.errors.searchFailed",
      0,
    );
  }
}
