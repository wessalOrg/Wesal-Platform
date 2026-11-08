import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import {
  mapProfessionalProfileContentPage,
  mapPublicProfessionalProfile,
} from "@/lib/professional-profile-mapper";
import { toUpdateProfessionalBioPayload } from "@/lib/professional-bio";
import type {
  ProfessionalProfileContentPage,
  PublicProfessionalProfile,
} from "@/types/professional-profile";

/** GET /api/v1/profile/{userId} — anonymous public professional profile. */
export async function fetchPublicProfessionalProfile(
  userId: string,
): Promise<PublicProfessionalProfile> {
  try {
    const { data } = await api.get<unknown>(
      `/profile/${encodeURIComponent(userId)}`,
      { timeout: 12000 },
    );
    const mapped = mapPublicProfessionalProfile(data);
    if (!mapped) {
      throw new ApiError("professionals.profile.errors.loadFailed", 0);
    }
    return mapped;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("professionals.profile.errors.loadFailed", 0);
  }
}

/** PUT /api/v1/profile/bio — owner only; Approved coordinator/photographer. */
export async function updateProfessionalBio(bio: string): Promise<void> {
  try {
    await api.put("/profile/bio", toUpdateProfessionalBioPayload(bio), {
      timeout: 10000,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("professionals.bio.errors.saveFailed", 0);
  }
}

const PICTURE_UPLOAD_TIMEOUT_MS = 60_000;

function stripFormContentType(body: unknown, headers: Record<string, unknown>) {
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    delete headers["Content-Type"];
  }
  return body;
}

/**
 * POST /api/v1/profile/picture — multipart field `file`.
 * Returns the public picture URL path from the API.
 */
export async function uploadProfessionalProfilePicture(
  file: File,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  try {
    const { data } = await api.post<unknown>("/profile/picture", formData, {
      timeout: PICTURE_UPLOAD_TIMEOUT_MS,
      transformRequest: [stripFormContentType],
    });
    const url =
      typeof data === "string"
        ? data.trim()
        : data && typeof data === "object"
          ? String(
              (data as Record<string, unknown>).url ??
                (data as Record<string, unknown>).Url ??
                "",
            ).trim()
          : "";
    if (!url) throw new ApiError("professionals.picture.errors.uploadFailed", 0);
    return url;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("professionals.picture.errors.uploadFailed", 0);
  }
}

/** GET /api/v1/posts/profile/{userId}?page=&pageSize= */
export async function fetchProfessionalProfilePosts(
  userId: string,
  page = 1,
  pageSize = 12,
): Promise<ProfessionalProfileContentPage> {
  const { data } = await api.get<unknown>(
    `/posts/profile/${encodeURIComponent(userId)}`,
    { params: { page, pageSize }, timeout: 12000 },
  );
  return mapProfessionalProfileContentPage(data);
}

/** GET /api/v1/offers/profile/{userId}?page=&pageSize= */
export async function fetchProfessionalProfileOffers(
  userId: string,
  page = 1,
  pageSize = 12,
): Promise<ProfessionalProfileContentPage> {
  const { data } = await api.get<unknown>(
    `/offers/profile/${encodeURIComponent(userId)}`,
    { params: { page, pageSize }, timeout: 12000 },
  );
  return mapProfessionalProfileContentPage(data);
}
