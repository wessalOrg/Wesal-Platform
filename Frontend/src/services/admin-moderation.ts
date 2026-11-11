import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import {
  mapAccountLockStatus,
  mapAdminActionResult,
  mapAdminLockedAccountPage,
  mapAdminModeratedContent,
  mapAdminModeratedContentPage,
} from "@/lib/admin-moderation-mapper";
import type {
  AccountLockStatus,
  AdminActionResult,
  AdminLockedAccountPage,
  AdminModeratedContent,
  AdminModeratedContentPage,
  AdminModerationListQuery,
  CreateAccountLockPayload,
} from "@/types/admin-moderation";

export const ADMIN_MODERATION_PATH = "/admin/moderation";

function listParams(query: AdminModerationListQuery = {}) {
  const params: Record<string, string | number> = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  };
  if (query.ownerId?.trim()) params.ownerId = query.ownerId.trim();
  if (query.ownerRole?.trim()) params.ownerRole = query.ownerRole.trim();
  if (query.search?.trim()) params.search = query.search.trim();
  return params;
}

/** DELETE /admin/moderation/posts/{postId} — body `{ reason }`. */
export async function deleteModeratedPost(
  postId: string,
  reason: string,
): Promise<AdminActionResult> {
  const { data } = await api.delete<unknown>(
    `${ADMIN_MODERATION_PATH}/posts/${encodeURIComponent(postId)}`,
    { data: { reason: reason.trim() }, timeout: 15000 },
  );
  return mapAdminActionResult(data);
}

/** DELETE /admin/moderation/offers/{offerId} — body `{ reason }`. */
export async function deleteModeratedOffer(
  offerId: string,
  reason: string,
): Promise<AdminActionResult> {
  const { data } = await api.delete<unknown>(
    `${ADMIN_MODERATION_PATH}/offers/${encodeURIComponent(offerId)}`,
    { data: { reason: reason.trim() }, timeout: 15000 },
  );
  return mapAdminActionResult(data);
}

/** POST /admin/moderation/users/{userId}/lock */
export async function lockProfessionalAccount(
  userId: string,
  payload: CreateAccountLockPayload,
): Promise<AccountLockStatus> {
  const { data } = await api.post<unknown>(
    `${ADMIN_MODERATION_PATH}/users/${encodeURIComponent(userId)}/lock`,
    {
      durationHours: payload.durationHours,
      reason: payload.reason?.trim() || null,
    },
    { timeout: 15000 },
  );
  return mapAccountLockStatus(data);
}

/** GET /admin/moderation/users/{userId}/lock */
export async function fetchProfessionalLockStatus(
  userId: string,
): Promise<AccountLockStatus> {
  const { data } = await api.get<unknown>(
    `${ADMIN_MODERATION_PATH}/users/${encodeURIComponent(userId)}/lock`,
    { timeout: 10000 },
  );
  return mapAccountLockStatus(data);
}

/** DELETE /admin/moderation/users/{userId}/lock */
export async function unlockProfessionalAccount(
  userId: string,
): Promise<AccountLockStatus> {
  const { data } = await api.delete<unknown>(
    `${ADMIN_MODERATION_PATH}/users/${encodeURIComponent(userId)}/lock`,
    { timeout: 15000 },
  );
  return mapAccountLockStatus(data);
}

/** GET /admin/moderation/posts */
export async function fetchAdminModeratedPosts(
  query: AdminModerationListQuery = {},
): Promise<AdminModeratedContentPage> {
  const { data } = await api.get<unknown>(`${ADMIN_MODERATION_PATH}/posts`, {
    params: listParams(query),
    timeout: 15000,
  });
  return mapAdminModeratedContentPage(data, "post");
}

/** GET /admin/moderation/posts/{postId} */
export async function fetchAdminModeratedPost(
  postId: string,
): Promise<AdminModeratedContent> {
  const { data } = await api.get<unknown>(
    `${ADMIN_MODERATION_PATH}/posts/${encodeURIComponent(postId)}`,
    { timeout: 10000 },
  );
  const mapped = mapAdminModeratedContent(data, "post");
  if (!mapped) throw new ApiError("admin.moderation.errors.notFound", 404);
  return mapped;
}

/** GET /admin/moderation/offers */
export async function fetchAdminModeratedOffers(
  query: AdminModerationListQuery = {},
): Promise<AdminModeratedContentPage> {
  const { data } = await api.get<unknown>(`${ADMIN_MODERATION_PATH}/offers`, {
    params: listParams(query),
    timeout: 15000,
  });
  return mapAdminModeratedContentPage(data, "offer");
}

/** GET /admin/moderation/offers/{offerId} */
export async function fetchAdminModeratedOffer(
  offerId: string,
): Promise<AdminModeratedContent> {
  const { data } = await api.get<unknown>(
    `${ADMIN_MODERATION_PATH}/offers/${encodeURIComponent(offerId)}`,
    { timeout: 10000 },
  );
  const mapped = mapAdminModeratedContent(data, "offer");
  if (!mapped) throw new ApiError("admin.moderation.errors.notFound", 404);
  return mapped;
}

/** GET /admin/moderation/locked/coordinators */
export async function fetchLockedCoordinators(
  query: AdminModerationListQuery = {},
): Promise<AdminLockedAccountPage> {
  const { data } = await api.get<unknown>(
    `${ADMIN_MODERATION_PATH}/locked/coordinators`,
    { params: listParams(query), timeout: 15000 },
  );
  return mapAdminLockedAccountPage(data);
}

/** GET /admin/moderation/locked/photographers */
export async function fetchLockedPhotographers(
  query: AdminModerationListQuery = {},
): Promise<AdminLockedAccountPage> {
  const { data } = await api.get<unknown>(
    `${ADMIN_MODERATION_PATH}/locked/photographers`,
    { params: listParams(query), timeout: 15000 },
  );
  return mapAdminLockedAccountPage(data);
}

/**
 * Authenticated blob for admin moderation image routes (Bearer required).
 * Path may be absolute `/api/v1/admin/moderation/...` or relative to the API base.
 */
export async function fetchAdminModerationImageBlob(
  imagePath: string,
): Promise<string | null> {
  const trimmed = imagePath.trim();
  if (!trimmed) return null;
  let path = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      path = url.pathname + url.search;
    } catch {
      return null;
    }
  }
  if (path.startsWith("/api/v1/")) {
    path = path.slice("/api/v1".length);
  }
  const { data, headers } = await api.get<Blob>(path, {
    responseType: "blob",
    timeout: 20000,
  });
  if (!(data instanceof Blob) || data.size === 0) return null;
  const typeHeader =
    typeof headers["content-type"] === "string"
      ? headers["content-type"].split(";")[0]?.trim()
      : "";
  const blob =
    typeHeader && !data.type
      ? new Blob([data], { type: typeHeader })
      : data;
  return URL.createObjectURL(blob);
}
