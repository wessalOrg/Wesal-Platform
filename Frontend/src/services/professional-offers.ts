import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { resolveOfferMediaUrl } from "@/lib/offer-format";
import {
  mapProfessionalProfileContentItem,
  mapProfessionalProfileContentPage,
} from "@/lib/professional-profile-mapper";
import type {
  CreateProfessionalOfferInput,
  PagedOffers,
  ProfessionalOffer,
  UpdateProfessionalOfferInput,
} from "@/types/offers";
import type {
  ProfessionalProfileContentItem,
  ProfessionalProfileContentPage,
} from "@/types/professional-profile";

export const PROFESSIONAL_OFFERS_PATH = "/offers";

const UPLOAD_TIMEOUT_MS = 120_000;

type ApiImage = {
  id?: string;
  Id?: string;
  url?: string;
  Url?: string;
  order?: number;
  Order?: number;
};

type ApiOffer = {
  id?: string;
  Id?: string;
  ownerUserId?: string | null;
  OwnerUserId?: string | null;
  content?: string | null;
  Content?: string | null;
  price?: number | null;
  Price?: number | null;
  oldPrice?: number | null;
  OldPrice?: number | null;
  offerPrice?: number | null;
  OfferPrice?: number | null;
  priceBox?: number | null;
  PriceBox?: number | null;
  startsAt?: string | null;
  StartsAt?: string | null;
  endsAt?: string | null;
  EndsAt?: string | null;
  stoppedAt?: string | null;
  StoppedAt?: string | null;
  createdAt?: string | null;
  CreatedAt?: string | null;
  updatedAt?: string | null;
  UpdatedAt?: string | null;
  saveCount?: number;
  SaveCount?: number;
  shareCount?: number;
  ShareCount?: number;
  images?: ApiImage[] | null;
  Images?: ApiImage[] | null;
};

type ApiPaged = {
  items?: ApiOffer[] | null;
  Items?: ApiOffer[] | null;
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

function mapImage(raw: ApiImage, offerId: string): {
  id: string;
  url: string;
  order: number;
} | null {
  const id = asText(raw.id ?? raw.Id);
  if (!id) return null;
  const urlRaw = asText(raw.url ?? raw.Url);
  const url =
    resolveOfferMediaUrl(urlRaw) ||
    resolveOfferMediaUrl(`/api/v1/offers/${offerId}/images/${id}`);
  return {
    id,
    url,
    order: asNumber(raw.order ?? raw.Order) ?? 0,
  };
}

export function mapProfessionalOffer(raw: ApiOffer | null | undefined): ProfessionalOffer | null {
  if (!raw || typeof raw !== "object") return null;
  const id = asText(raw.id ?? raw.Id);
  if (!id) return null;
  const oldPrice = asNumber(raw.oldPrice ?? raw.OldPrice) ?? 0;
  const offerPrice = asNumber(raw.offerPrice ?? raw.OfferPrice) ?? 0;
  const startsAt = asText(raw.startsAt ?? raw.StartsAt);
  const endsAt = asText(raw.endsAt ?? raw.EndsAt);
  if (!startsAt || !endsAt) return null;
  const imagesRaw = raw.images ?? raw.Images ?? [];
  const images = Array.isArray(imagesRaw)
    ? imagesRaw
        .map((img) => mapImage(img, id))
        .filter((img): img is NonNullable<typeof img> => Boolean(img))
        .sort((a, b) => a.order - b.order)
    : [];

  return {
    id,
    ownerUserId: asText(raw.ownerUserId ?? raw.OwnerUserId) || null,
    content: asText(raw.content ?? raw.Content) || null,
    oldPrice,
    offerPrice,
    priceBox: asNumber(raw.priceBox ?? raw.PriceBox ?? raw.price ?? raw.Price),
    startsAt,
    endsAt,
    stoppedAt: asText(raw.stoppedAt ?? raw.StoppedAt) || null,
    createdAt: asText(raw.createdAt ?? raw.CreatedAt) || null,
    updatedAt: asText(raw.updatedAt ?? raw.UpdatedAt) || null,
    images,
    saveCount: asNumber(raw.saveCount ?? raw.SaveCount) ?? 0,
    shareCount: asNumber(raw.shareCount ?? raw.ShareCount) ?? 0,
  };
}

function mapPaged(data: ApiPaged | null | undefined): PagedOffers<ProfessionalOffer> {
  const rows = data?.items ?? data?.Items ?? [];
  const items = Array.isArray(rows)
    ? rows
        .map(mapProfessionalOffer)
        .filter((row): row is ProfessionalOffer => Boolean(row))
    : [];
  const pageNumber = asNumber(data?.pageNumber ?? data?.PageNumber) ?? 1;
  const pageSize = asNumber(data?.pageSize ?? data?.PageSize) ?? items.length;
  const totalCount = asNumber(data?.totalCount ?? data?.TotalCount) ?? items.length;
  const totalPages =
    asNumber(data?.totalPages ?? data?.TotalPages) ??
    (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0);
  return { items, pageNumber, pageSize, totalCount, totalPages };
}

function appendOfferFields(
  form: FormData,
  input: CreateProfessionalOfferInput,
): void {
  if (input.content != null && input.content.trim()) {
    form.append("content", input.content.trim());
  }
  form.append("oldPrice", String(input.oldPrice));
  form.append("offerPrice", String(input.offerPrice));
  if (input.priceBox != null && Number.isFinite(input.priceBox)) {
    form.append("priceBox", String(input.priceBox));
  }
  form.append("startsAt", input.startsAt);
  form.append("endsAt", input.endsAt);
  for (const file of input.images ?? []) {
    form.append("images", file, file.name);
  }
}

const multipartConfig = {
  timeout: UPLOAD_TIMEOUT_MS,
  transformRequest: [
    (body: unknown, headers?: Record<string, unknown>) => {
      if (typeof FormData !== "undefined" && body instanceof FormData) {
        if (headers && typeof headers === "object") {
          delete headers["Content-Type"];
        }
      }
      return body;
    },
  ],
};

/** POST /offers — EventCoordinator / Photographer + Approved */
export async function createProfessionalOffer(
  input: CreateProfessionalOfferInput,
): Promise<string> {
  const form = new FormData();
  appendOfferFields(form, input);
  try {
    const { data } = await api.post<{ id?: string; Id?: string }>(
      PROFESSIONAL_OFFERS_PATH,
      form,
      multipartConfig,
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

/** PUT /offers/{offerId} */
export async function updateProfessionalOffer(
  offerId: string,
  input: UpdateProfessionalOfferInput,
): Promise<void> {
  const form = new FormData();
  appendOfferFields(form, input);
  form.append("replaceImages", String(input.replaceImages));
  for (const keepId of input.keepImageIds) {
    form.append("keepImageIds", keepId);
  }
  try {
    await api.put(
      `${PROFESSIONAL_OFFERS_PATH}/${encodeURIComponent(offerId)}`,
      form,
      multipartConfig,
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "offers.errors.updateFailed",
      0,
    );
  }
}

/** POST /offers/{offerId}/stop */
export async function stopProfessionalOffer(offerId: string): Promise<void> {
  try {
    await api.post(
      `${PROFESSIONAL_OFFERS_PATH}/${encodeURIComponent(offerId)}/stop`,
      undefined,
      { timeout: 15000 },
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "offers.errors.stopFailed",
      0,
    );
  }
}

/** GET /offers/mine — typed for offers manage UI (§10). */
export async function fetchMyProfessionalOffers(
  page = 1,
  pageSize = 20,
): Promise<PagedOffers<ProfessionalOffer>> {
  try {
    const { data } = await api.get<ApiPaged>(`${PROFESSIONAL_OFFERS_PATH}/mine`, {
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

/**
 * GET /offers/mine — teammate professional dashboard shape
 * (ProfessionalProfileContentPage).
 */
export async function fetchOwnProfessionalOffers(
  page = 1,
  pageSize = 20,
): Promise<ProfessionalProfileContentPage> {
  const { data } = await api.get<unknown>("/offers/mine", {
    params: { page, pageSize },
    timeout: 12000,
  });
  return mapProfessionalProfileContentPage(data);
}

/** GET /offers/profile/{userId} — active offers only */
export async function fetchProfileProfessionalOffers(
  userId: string,
  page = 1,
  pageSize = 20,
): Promise<PagedOffers<ProfessionalOffer>> {
  try {
    const { data } = await api.get<ApiPaged>(
      `${PROFESSIONAL_OFFERS_PATH}/profile/${encodeURIComponent(userId)}`,
      { params: { page, pageSize }, timeout: 15000 },
    );
    return mapPaged(data);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "offers.errors.loadFailed",
      0,
    );
  }
}

/** GET /offers/{offerId} — typed for offers manage/edit (§10). */
export async function fetchProfessionalOffer(
  offerId: string,
): Promise<ProfessionalOffer> {
  try {
    const { data } = await api.get<ApiOffer>(
      `${PROFESSIONAL_OFFERS_PATH}/${encodeURIComponent(offerId)}`,
      { timeout: 15000 },
    );
    const mapped = mapProfessionalOffer(data);
    if (!mapped) throw new ApiError("offers.errors.notFound", 404);
    return mapped;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "offers.errors.loadFailed",
      0,
    );
  }
}

/** GET /offers/{offerId} — teammate dashboard content-item shape. */
export async function fetchProfessionalOfferContentItem(
  offerId: string,
): Promise<ProfessionalProfileContentItem> {
  const { data } = await api.get<unknown>(
    `/offers/${encodeURIComponent(offerId)}`,
    { timeout: 10000 },
  );
  const mapped = mapProfessionalProfileContentItem(data);
  if (!mapped) throw new ApiError("professionals.offers.errors.loadFailed", 0);
  return mapped;
}
