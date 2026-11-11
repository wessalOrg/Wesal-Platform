import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { resolveOfferMediaUrl } from "@/lib/offer-format";
import type {
  FavoritePost,
  PagedResult,
  PostComment,
  PostImage,
} from "@/types/posts";

export const POST_COMMENT_MAX_LENGTH = 1000;

type ApiComment = {
  id?: string;
  Id?: string;
  postId?: string;
  PostId?: string;
  text?: string;
  Text?: string;
  authorUserId?: string;
  AuthorUserId?: string;
  authorName?: string;
  AuthorName?: string;
  authorAvatarUrl?: string | null;
  AuthorAvatarUrl?: string | null;
  parentCommentId?: string | null;
  ParentCommentId?: string | null;
  replyToCommentId?: string | null;
  ReplyToCommentId?: string | null;
  replyCount?: number;
  ReplyCount?: number;
  createdAt?: string;
  CreatedAt?: string;
};

type ApiFavorite = {
  id?: string;
  Id?: string;
  ownerUserId?: string;
  OwnerUserId?: string;
  ownerName?: string;
  OwnerName?: string;
  ownerAvatarUrl?: string | null;
  OwnerAvatarUrl?: string | null;
  content?: string | null;
  Content?: string | null;
  price?: number | null;
  Price?: number | null;
  saveCount?: number;
  SaveCount?: number;
  savedAt?: string;
  SavedAt?: string;
  images?: Array<{
    id?: string;
    Id?: string;
    url?: string;
    Url?: string;
    order?: number;
    Order?: number;
  }> | null;
  Images?: Array<{
    id?: string;
    Id?: string;
    url?: string;
    Url?: string;
    order?: number;
    Order?: number;
  }> | null;
};

type ApiPaged<T> = {
  items?: T[] | null;
  Items?: T[] | null;
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

export function mapPostComment(raw: ApiComment | null | undefined): PostComment | null {
  if (!raw || typeof raw !== "object") return null;
  const id = asText(raw.id ?? raw.Id);
  const postId = asText(raw.postId ?? raw.PostId);
  const text = asText(raw.text ?? raw.Text);
  const createdAt = asText(raw.createdAt ?? raw.CreatedAt);
  if (!id || !postId || !text || !createdAt) return null;
  return {
    id,
    postId,
    text,
    authorUserId: asText(raw.authorUserId ?? raw.AuthorUserId),
    authorName: asText(raw.authorName ?? raw.AuthorName) || "—",
    authorAvatarUrl:
      resolveOfferMediaUrl(asText(raw.authorAvatarUrl ?? raw.AuthorAvatarUrl)) ||
      null,
    parentCommentId: asText(raw.parentCommentId ?? raw.ParentCommentId) || null,
    replyToCommentId: asText(raw.replyToCommentId ?? raw.ReplyToCommentId) || null,
    replyCount: asNumber(raw.replyCount ?? raw.ReplyCount) ?? 0,
    createdAt,
  };
}

function mapFavorite(raw: ApiFavorite | null | undefined): FavoritePost | null {
  if (!raw || typeof raw !== "object") return null;
  const id = asText(raw.id ?? raw.Id);
  if (!id) return null;
  const imagesRaw = raw.images ?? raw.Images ?? [];
  const images: PostImage[] = Array.isArray(imagesRaw)
    ? imagesRaw
        .map((img) => {
          const imgId = asText(img.id ?? img.Id);
          if (!imgId) return null;
          const url =
            resolveOfferMediaUrl(asText(img.url ?? img.Url)) ||
            resolveOfferMediaUrl(`/api/v1/posts/${id}/images/${imgId}`);
          return {
            id: imgId,
            url,
            order: asNumber(img.order ?? img.Order) ?? 0,
          } satisfies PostImage;
        })
        .filter((img): img is PostImage => Boolean(img))
        .sort((a, b) => a.order - b.order)
    : [];
  return {
    id,
    ownerUserId: asText(raw.ownerUserId ?? raw.OwnerUserId),
    ownerName: asText(raw.ownerName ?? raw.OwnerName),
    ownerAvatarUrl:
      resolveOfferMediaUrl(asText(raw.ownerAvatarUrl ?? raw.OwnerAvatarUrl)) ||
      null,
    content: asText(raw.content ?? raw.Content) || null,
    price: asNumber(raw.price ?? raw.Price),
    saveCount: asNumber(raw.saveCount ?? raw.SaveCount) ?? 0,
    savedAt: asText(raw.savedAt ?? raw.SavedAt) || new Date().toISOString(),
    images,
  };
}

function mapPagedComments(
  data: ApiPaged<ApiComment> | null | undefined,
): PagedResult<PostComment> {
  const rows = data?.items ?? data?.Items ?? [];
  const items = Array.isArray(rows)
    ? rows.map(mapPostComment).filter((row): row is PostComment => Boolean(row))
    : [];
  const pageNumber = asNumber(data?.pageNumber ?? data?.PageNumber) ?? 1;
  const pageSize = asNumber(data?.pageSize ?? data?.PageSize) ?? items.length;
  const totalCount = asNumber(data?.totalCount ?? data?.TotalCount) ?? items.length;
  const totalPages =
    asNumber(data?.totalPages ?? data?.TotalPages) ??
    (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0);
  return { items, pageNumber, pageSize, totalCount, totalPages };
}

function mapPagedFavorites(
  data: ApiPaged<ApiFavorite> | null | undefined,
): PagedResult<FavoritePost> {
  const rows = data?.items ?? data?.Items ?? [];
  const items = Array.isArray(rows)
    ? rows.map(mapFavorite).filter((row): row is FavoritePost => Boolean(row))
    : [];
  const pageNumber = asNumber(data?.pageNumber ?? data?.PageNumber) ?? 1;
  const pageSize = asNumber(data?.pageSize ?? data?.PageSize) ?? items.length;
  const totalCount = asNumber(data?.totalCount ?? data?.TotalCount) ?? items.length;
  const totalPages =
    asNumber(data?.totalPages ?? data?.TotalPages) ??
    (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0);
  return { items, pageNumber, pageSize, totalCount, totalPages };
}

/** POST /posts/{postId}/comments — body `{ text }` */
export async function createPostComment(
  postId: string,
  text: string,
): Promise<PostComment> {
  try {
    const { data } = await api.post<ApiComment>(
      `/posts/${encodeURIComponent(postId)}/comments`,
      { text: text.trim() },
    );
    const mapped = mapPostComment(data);
    if (!mapped) throw new ApiError("posts.comments.errors.createFailed", 0);
    return mapped;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "posts.comments.errors.createFailed",
      0,
    );
  }
}

/** GET /posts/{postId}/comments */
export async function fetchPostComments(
  postId: string,
  page = 1,
  pageSize = 20,
): Promise<PagedResult<PostComment>> {
  try {
    const { data } = await api.get<ApiPaged<ApiComment>>(
      `/posts/${encodeURIComponent(postId)}/comments`,
      { params: { page, pageSize }, timeout: 15000 },
    );
    return mapPagedComments(data);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "posts.comments.errors.loadFailed",
      0,
    );
  }
}

/** POST /posts/{postId}/comments/{commentId}/replies */
export async function replyToPostComment(
  postId: string,
  commentId: string,
  text: string,
): Promise<PostComment> {
  try {
    const { data } = await api.post<ApiComment>(
      `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/replies`,
      { text: text.trim() },
    );
    const mapped = mapPostComment(data);
    if (!mapped) throw new ApiError("posts.comments.errors.replyFailed", 0);
    return mapped;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "posts.comments.errors.replyFailed",
      0,
    );
  }
}

/** GET /posts/{postId}/comments/{commentId}/replies */
export async function fetchPostCommentReplies(
  postId: string,
  commentId: string,
  page = 1,
  pageSize = 20,
): Promise<PagedResult<PostComment>> {
  try {
    const { data } = await api.get<ApiPaged<ApiComment>>(
      `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}/replies`,
      { params: { page, pageSize }, timeout: 15000 },
    );
    return mapPagedComments(data);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "posts.comments.errors.loadFailed",
      0,
    );
  }
}

/** DELETE /posts/{postId}/comments/{commentId} */
export async function deletePostComment(
  postId: string,
  commentId: string,
): Promise<void> {
  try {
    await api.delete(
      `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    );
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "posts.comments.errors.deleteFailed",
      0,
    );
  }
}

/** POST /posts/{postId}/favorites */
export async function addPostFavorite(postId: string): Promise<void> {
  try {
    await api.post(`/posts/${encodeURIComponent(postId)}/favorites`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "posts.favorites.errors.addFailed",
      0,
    );
  }
}

/** DELETE /posts/{postId}/favorites */
export async function removePostFavorite(postId: string): Promise<void> {
  try {
    await api.delete(`/posts/${encodeURIComponent(postId)}/favorites`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "posts.favorites.errors.removeFailed",
      0,
    );
  }
}

/** GET /favorites?page=&pageSize= — saved posts */
export async function fetchFavoritePosts(
  page = 1,
  pageSize = 20,
): Promise<PagedResult<FavoritePost>> {
  try {
    const { data } = await api.get<ApiPaged<ApiFavorite>>("/favorites", {
      params: { page, pageSize },
      timeout: 15000,
    });
    return mapPagedFavorites(data);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "posts.favorites.errors.loadFailed",
      0,
    );
  }
}
