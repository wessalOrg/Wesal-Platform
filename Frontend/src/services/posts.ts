import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { resolveOfferMediaUrl } from "@/lib/offer-format";
import type { PagedResult, Post, PostImage } from "@/types/posts";

export const POSTS_PATH = "/posts";

type ApiImage = {
  id?: string;
  Id?: string;
  url?: string;
  Url?: string;
  order?: number;
  Order?: number;
};

type ApiPost = {
  id?: string;
  Id?: string;
  ownerUserId?: string | null;
  OwnerUserId?: string | null;
  ownerName?: string | null;
  OwnerName?: string | null;
  ownerDisplayName?: string | null;
  OwnerDisplayName?: string | null;
  ownerAvatarUrl?: string | null;
  OwnerAvatarUrl?: string | null;
  ownerRole?: string | null;
  OwnerRole?: string | null;
  content?: string | null;
  Content?: string | null;
  price?: number | null;
  Price?: number | null;
  saveCount?: number;
  SaveCount?: number;
  shareCount?: number;
  ShareCount?: number;
  commentCount?: number;
  CommentCount?: number;
  isSavedByCurrentUser?: boolean;
  IsSavedByCurrentUser?: boolean;
  isFavorited?: boolean;
  IsFavorited?: boolean;
  createdAt?: string | null;
  CreatedAt?: string | null;
  updatedAt?: string | null;
  UpdatedAt?: string | null;
  images?: ApiImage[] | null;
  Images?: ApiImage[] | null;
};

type ApiPaged = {
  items?: ApiPost[] | null;
  Items?: ApiPost[] | null;
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

function mapImage(raw: ApiImage, postId: string): PostImage | null {
  const id = asText(raw.id ?? raw.Id);
  if (!id) return null;
  const urlRaw = asText(raw.url ?? raw.Url);
  const url =
    resolveOfferMediaUrl(urlRaw) ||
    resolveOfferMediaUrl(`/api/v1/posts/${postId}/images/${id}`);
  return { id, url, order: asNumber(raw.order ?? raw.Order) ?? 0 };
}

export function mapPost(raw: ApiPost | null | undefined): Post | null {
  if (!raw || typeof raw !== "object") return null;
  const id = asText(raw.id ?? raw.Id);
  if (!id) return null;
  const imagesRaw = raw.images ?? raw.Images ?? [];
  const images = Array.isArray(imagesRaw)
    ? imagesRaw
        .map((img) => mapImage(img, id))
        .filter((img): img is PostImage => Boolean(img))
        .sort((a, b) => a.order - b.order)
    : [];
  return {
    id,
    ownerUserId: asText(raw.ownerUserId ?? raw.OwnerUserId) || null,
    ownerName:
      asText(raw.ownerName ?? raw.OwnerName ?? raw.ownerDisplayName ?? raw.OwnerDisplayName) ||
      null,
    ownerAvatarUrl:
      resolveOfferMediaUrl(asText(raw.ownerAvatarUrl ?? raw.OwnerAvatarUrl)) || null,
    ownerRole: asText(raw.ownerRole ?? raw.OwnerRole) || null,
    content: asText(raw.content ?? raw.Content) || null,
    price: asNumber(raw.price ?? raw.Price),
    saveCount: asNumber(raw.saveCount ?? raw.SaveCount) ?? 0,
    shareCount: asNumber(raw.shareCount ?? raw.ShareCount) ?? 0,
    commentCount: asNumber(raw.commentCount ?? raw.CommentCount) ?? 0,
    isSavedByCurrentUser: Boolean(
      raw.isSavedByCurrentUser ??
        raw.IsSavedByCurrentUser ??
        raw.isFavorited ??
        raw.IsFavorited,
    ),
    createdAt: asText(raw.createdAt ?? raw.CreatedAt) || null,
    updatedAt: asText(raw.updatedAt ?? raw.UpdatedAt) || null,
    images,
  };
}

function mapPaged(data: ApiPaged | null | undefined): PagedResult<Post> {
  const rows = data?.items ?? data?.Items ?? [];
  const items = Array.isArray(rows)
    ? rows.map(mapPost).filter((row): row is Post => Boolean(row))
    : [];
  const pageNumber = asNumber(data?.pageNumber ?? data?.PageNumber) ?? 1;
  const pageSize = asNumber(data?.pageSize ?? data?.PageSize) ?? items.length;
  const totalCount = asNumber(data?.totalCount ?? data?.TotalCount) ?? items.length;
  const totalPages =
    asNumber(data?.totalPages ?? data?.TotalPages) ??
    (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0);
  return { items, pageNumber, pageSize, totalCount, totalPages };
}

/** GET /posts/{postId} — records a view on success. */
export async function fetchPost(postId: string): Promise<Post> {
  try {
    const { data } = await api.get<ApiPost>(
      `${POSTS_PATH}/${encodeURIComponent(postId)}`,
      { timeout: 15000 },
    );
    const mapped = mapPost(data);
    if (!mapped) throw new ApiError("posts.errors.notFound", 404);
    return mapped;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "posts.errors.loadFailed",
      0,
    );
  }
}

/** GET /posts/profile/{userId} */
export async function fetchProfilePosts(
  userId: string,
  page = 1,
  pageSize = 20,
): Promise<PagedResult<Post>> {
  try {
    const { data } = await api.get<ApiPaged>(
      `${POSTS_PATH}/profile/${encodeURIComponent(userId)}`,
      { params: { page, pageSize }, timeout: 15000 },
    );
    return mapPaged(data);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "posts.errors.loadFailed",
      0,
    );
  }
}

/** GET /posts/{postId}/share-link */
export async function fetchPostShareLink(postId: string): Promise<string> {
  try {
    const { data } = await api.get<{ shareLink?: string; ShareLink?: string }>(
      `${POSTS_PATH}/${encodeURIComponent(postId)}/share-link`,
      { timeout: 10000 },
    );
    const link = asText(data?.shareLink ?? data?.ShareLink);
    if (link) return link;
    if (typeof window !== "undefined") {
      return `${window.location.origin}/posts/${encodeURIComponent(postId)}`;
    }
    return `/posts/${encodeURIComponent(postId)}`;
  } catch (err) {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/posts/${encodeURIComponent(postId)}`;
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "posts.errors.shareFailed",
      0,
    );
  }
}

/** POST /posts/{postId}/shares — platform share counter (authenticated). */
export async function recordPostShare(postId: string): Promise<void> {
  try {
    await api.post(`${POSTS_PATH}/${encodeURIComponent(postId)}/shares`);
  } catch {
    /* non-blocking for clipboard share UX */
  }
}
