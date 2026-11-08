import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import {
  mapProfessionalProfileContentItem,
  mapProfessionalProfileContentPage,
} from "@/lib/professional-profile-mapper";
import type {
  ProfessionalProfileContentItem,
  ProfessionalProfileContentPage,
} from "@/types/professional-profile";

const UPLOAD_TIMEOUT_MS = 60_000;

function stripFormContentType(body: unknown, headers: Record<string, unknown>) {
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    delete headers["Content-Type"];
  }
  return body;
}

export type CreateProfessionalOfferInput = {
  content: string;
  oldPrice: number;
  offerPrice: number;
  priceBox: number | null;
  startsAt: string;
  endsAt: string;
  images: File[];
};

/** POST /api/v1/offers — multipart. */
export async function createProfessionalOffer(
  input: CreateProfessionalOfferInput,
): Promise<string> {
  const formData = new FormData();
  const content = input.content.trim();
  if (content) formData.append("content", content);
  formData.append("oldPrice", String(input.oldPrice));
  formData.append("offerPrice", String(input.offerPrice));
  if (input.priceBox != null) formData.append("priceBox", String(input.priceBox));
  formData.append("startsAt", input.startsAt);
  formData.append("endsAt", input.endsAt);
  for (const file of input.images) {
    formData.append("images", file, file.name);
  }
  try {
    const { data } = await api.post<unknown>("/offers", formData, {
      timeout: UPLOAD_TIMEOUT_MS,
      transformRequest: [stripFormContentType],
    });
    const id = readCreatedId(data);
    if (!id) throw new ApiError("professionals.offers.errors.createFailed", 0);
    return id;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("professionals.offers.errors.createFailed", 0);
  }
}

/** POST /api/v1/offers/{offerId}/stop */
export async function stopProfessionalOffer(offerId: string): Promise<void> {
  try {
    await api.post(`/offers/${encodeURIComponent(offerId)}/stop`, undefined, {
      timeout: 15000,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("professionals.offers.errors.stopFailed", 0);
  }
}

/** GET /api/v1/offers/mine — owner management list (includes stopped/expired). */
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

/** GET /api/v1/offers/{offerId} */
export async function fetchProfessionalOffer(
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

function readCreatedId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const raw = dto.id ?? dto.Id;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return null;
}
