import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import type { OwnerStatistics, PostStatisticsItem } from "@/types/statistics";

export const STATISTICS_PATH = "/statistics";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  }
  return 0;
}

function mapPostItem(raw: unknown): PostStatisticsItem | null {
  const dto = asRecord(raw);
  if (!dto) return null;
  const postId = asText(dto.postId ?? dto.PostId);
  if (!postId) return null;
  return {
    postId,
    content: asText(dto.content ?? dto.Content) || null,
    saveCount: asInt(dto.saveCount ?? dto.SaveCount),
    shareCount: asInt(dto.shareCount ?? dto.ShareCount),
    viewCount: asInt(dto.viewCount ?? dto.ViewCount),
  };
}

export function mapOwnerStatistics(raw: unknown): OwnerStatistics {
  const dto = asRecord(raw) ?? {};
  const list = dto.posts ?? dto.Posts;
  const posts = Array.isArray(list)
    ? list.map(mapPostItem).filter((item): item is PostStatisticsItem => Boolean(item))
    : [];

  return {
    pageNumber: asInt(dto.pageNumber ?? dto.PageNumber) || 1,
    pageSize: asInt(dto.pageSize ?? dto.PageSize) || posts.length || 10,
    totalPosts: asInt(dto.totalPosts ?? dto.TotalPosts),
    profileViewCount: asInt(dto.profileViewCount ?? dto.ProfileViewCount),
    totalSaveCount: asInt(dto.totalSaveCount ?? dto.TotalSaveCount),
    totalShareCount: asInt(dto.totalShareCount ?? dto.TotalShareCount),
    totalPostViewCount: asInt(dto.totalPostViewCount ?? dto.TotalPostViewCount),
    posts,
  };
}

/**
 * GET /statistics/me?page=&pageSize=
 * Professional (coordinator / photographer) engagement aggregates only.
 * Views are total request counts — not unique viewers; no per-event notifications.
 */
export async function fetchMyStatistics(
  page = 1,
  pageSize = 20,
): Promise<OwnerStatistics> {
  try {
    const { data } = await api.get<unknown>(`${STATISTICS_PATH}/me`, {
      params: { page, pageSize },
      timeout: 15000,
    });
    return mapOwnerStatistics(data);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("statistics.errors.loadFailed", 0);
  }
}
