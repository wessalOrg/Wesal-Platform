import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { resolveOfferMediaUrl } from "@/lib/offer-format";
import type {
  CreateHallOfferInput,
  HallOffer,
  PagedOffers,
  UpdateHallOfferInput,
} from "@/types/offers";

function ownerHallOffersPath(hallId: string) {
  return `/owner/halls/${encodeURIComponent(hallId)}/offers`;
}

function publicActiveOfferPath(hallId: string) {
  return `/halls/${encodeURIComponent(hallId)}/offers/active`;
}

type ApiHallOffer = {
  id?: string;
  Id?: string;
  hallId?: string;
  HallId?: string;
  hallName?: string;
  HallName?: string;
  mainImageUrl?: string | null;
  MainImageUrl?: string | null;
  oldBookingPrice?: number;
  OldBookingPrice?: number;
  offerPrice?: number;
  OfferPrice?: number;
  startsAt?: string;
  StartsAt?: string;
  endsAt?: string;
  EndsAt?: string;
  stoppedAt?: string | null;
  StoppedAt?: string | null;
};

type ApiPaged = {
  items?: ApiHallOffer[] | null;
  Items?: ApiHallOffer[] | null;
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

export function mapHallOffer(raw: ApiHallOffer | null | undefined): HallOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const id = asText(raw.id ?? raw.Id);
  const hallId = asText(raw.hallId ?? raw.HallId);
  const startsAt = asText(raw.startsAt ?? raw.StartsAt);
  const endsAt = asText(raw.endsAt ?? raw.EndsAt);
  if (!id || !hallId || !startsAt || !endsAt) return null;
  return {
    id,
    hallId,
    hallName: asText(raw.hallName ?? raw.HallName),
    mainImageUrl:
      resolveOfferMediaUrl(asText(raw.mainImageUrl ?? raw.MainImageUrl)) || null,
    oldBookingPrice: asNumber(raw.oldBookingPrice ?? raw.OldBookingPrice) ?? 0,
    offerPrice: asNumber(raw.offerPrice ?? raw.OfferPrice) ?? 0,
    startsAt,
    endsAt,
    stoppedAt: asText(raw.stoppedAt ?? raw.StoppedAt) || null,
  };
}

function mapPaged(data: ApiPaged | null | undefined): PagedOffers<HallOffer> {
  const rows = data?.items ?? data?.Items ?? [];
  const items = Array.isArray(rows)
    ? rows.map(mapHallOffer).filter((row): row is HallOffer => Boolean(row))
    : [];
  const pageNumber = asNumber(data?.pageNumber ?? data?.PageNumber) ?? 1;
  const pageSize = asNumber(data?.pageSize ?? data?.PageSize) ?? items.length;
  const totalCount = asNumber(data?.totalCount ?? data?.TotalCount) ?? items.length;
  const totalPages =
    asNumber(data?.totalPages ?? data?.TotalPages) ??
    (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0);
  return { items, pageNumber, pageSize, totalCount, totalPages };
}

/** POST /owner/halls/{hallId}/offers */
export async function createHallOffer(
  hallId: string,
  input: CreateHallOfferInput,
): Promise<string> {
  try {
    const { data } = await api.post<{ id?: string; Id?: string }>(
      ownerHallOffersPath(hallId),
      {
        oldBookingPrice: input.oldBookingPrice,
        offerPrice: input.offerPrice,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
    );
    const id = asText(data?.id ?? data?.Id);
    if (!id) throw new ApiError("offers.errors.createFailed", 0);
    return id;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "offers.errors.createFailed",
      0,
    );
  }
}

/** GET /owner/halls/{hallId}/offers */
export async function fetchOwnerHallOffers(
  hallId: string,
  page = 1,
  pageSize = 20,
): Promise<PagedOffers<HallOffer>> {
  try {
    const { data } = await api.get<ApiPaged>(ownerHallOffersPath(hallId), {
      params: { page, pageSize },
      timeout: 15000,
    });
    return mapPaged(data);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "offers.errors.loadFailed",
      0,
    );
  }
}

/** PUT /owner/halls/{hallId}/offers/{offerId} */
export async function updateHallOffer(
  hallId: string,
  offerId: string,
  input: UpdateHallOfferInput,
): Promise<void> {
  try {
    await api.put(
      `${ownerHallOffersPath(hallId)}/${encodeURIComponent(offerId)}`,
      {
        oldBookingPrice: input.oldBookingPrice,
        offerPrice: input.offerPrice,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      },
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "offers.errors.updateFailed",
      0,
    );
  }
}

/** POST /owner/halls/{hallId}/offers/{offerId}/stop */
export async function stopHallOffer(
  hallId: string,
  offerId: string,
): Promise<void> {
  try {
    await api.post(
      `${ownerHallOffersPath(hallId)}/${encodeURIComponent(offerId)}/stop`,
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "offers.errors.stopFailed",
      0,
    );
  }
}

/**
 * GET /halls/{hallId}/offers/active
 * Returns null when no active offer (404).
 */
export async function fetchActiveHallOffer(
  hallId: string,
): Promise<HallOffer | null> {
  try {
    const { data } = await api.get<ApiHallOffer>(publicActiveOfferPath(hallId), {
      timeout: 10000,
    });
    return mapHallOffer(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "offers.errors.loadFailed",
      0,
    );
  }
}
