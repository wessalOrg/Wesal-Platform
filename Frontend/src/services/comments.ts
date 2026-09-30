import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { t } from "@/i18n";
import { resolveMediaUrl } from "@/lib/hall-media-url";
import { getStoredUiLang } from "@/lib/language";
import type { HallReview } from "@/types/hall";

/** Mirrors the API rule: content must be non-blank and at most this long. */
export const COMMENT_MAX_LENGTH = 1000;

export type HallComment = {
  commentId: string;
  hallId: string;
  userId: string;
  author: string;
  avatarUrl: string | null;
  body: string;
  createdAt: string;
};

/** Mirrors the API `CommentResponse` (camelCase and PascalCase). */
type CommentResponse = {
  commentId?: string;
  CommentId?: string;
  hallId?: string;
  HallId?: string;
  content?: string;
  Content?: string;
  userId?: string;
  UserId?: string;
  userName?: string;
  UserName?: string;
  userProfilePictureUrl?: string | null;
  UserProfilePictureUrl?: string | null;
  createdAt?: string;
  CreatedAt?: string;
};

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
};

/** Comment text is stored HTML-encoded, so entities are decoded once before render. */
function decodeHtmlEntities(raw: string): string {
  if (!raw.includes("&")) return raw;
  return raw.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, token: string) => {
    const key = token.toLowerCase();
    if (!key.startsWith("#")) {
      return HTML_ENTITIES[key] ?? match;
    }
    const code = key.startsWith("#x")
      ? Number.parseInt(key.slice(2), 16)
      : Number.parseInt(key.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : match;
  });
}

export function validateCommentBody(raw: string): string | null {
  const body = raw.trim();
  if (!body) {
    return t("halls.comment.emptyBody");
  }
  if (body.length > COMMENT_MAX_LENGTH) {
    return t("halls.comment.maxLength", { count: COMMENT_MAX_LENGTH });
  }
  return null;
}

export function formatCommentTimeAgo(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return t("common.now");
  if (minutes < 60) return t("common.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("common.hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("common.daysAgo", { count: days });

  const lang = typeof window === "undefined" ? "ar" : getStoredUiLang();
  return date.toLocaleDateString(lang === "en" ? "en-GB" : "ar-EG");
}

export function mapCommentToReview(comment: HallComment): HallReview {
  return {
    id: comment.commentId,
    author: comment.author,
    comment: comment.body,
    timeAgo: formatCommentTimeAgo(comment.createdAt),
    userId: comment.userId || null,
    avatarUrl: comment.avatarUrl,
  };
}

function textField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function mapResponse(data: CommentResponse, fallbackHallId: string): HallComment {
  const author = textField(data.userName ?? data.UserName);
  const picture = textField(data.userProfilePictureUrl ?? data.UserProfilePictureUrl);
  return {
    commentId: textField(data.commentId ?? data.CommentId) || `comment-${Date.now()}`,
    hallId: textField(data.hallId ?? data.HallId) || fallbackHallId,
    userId: textField(data.userId ?? data.UserId),
    author: author ? decodeHtmlEntities(author) : t("common.user"),
    avatarUrl: picture ? resolveMediaUrl(picture) || null : null,
    body: decodeHtmlEntities(textField(data.content ?? data.Content)),
    createdAt: textField(data.createdAt ?? data.CreatedAt) || new Date().toISOString(),
  };
}

export async function fetchHallComments(hallId: string): Promise<HallComment[] | null> {
  try {
    const { data } = await api.get<CommentResponse[]>(`/comments/hall/${hallId}`, {
      timeout: 5000,
    });
    if (!Array.isArray(data)) {
      return [];
    }
    return data.map((item) => mapResponse(item, hallId));
  } catch {
    return null;
  }
}

export async function submitHallComment(
  hallId: string,
  body: string,
): Promise<HallComment> {
  const { data } = await api.post<CommentResponse>(
    "/comments",
    { hallId, content: body.trim() },
    { timeout: 8000 },
  );
  return mapResponse(data, hallId);
}

/** PUT /comments/{commentId} — author only. Returns the persisted comment. */
export async function updateHallComment(
  commentId: string,
  body: string,
): Promise<HallComment> {
  const { data } = await api.put<CommentResponse>(
    `/comments/${encodeURIComponent(commentId)}`,
    { content: body.trim() },
    { timeout: 8000 },
  );
  return mapResponse(data, "");
}

/** DELETE /comments/{commentId} — author only. 204 on success. */
export async function deleteHallComment(commentId: string): Promise<void> {
  await api.delete(`/comments/${encodeURIComponent(commentId)}`, { timeout: 8000 });
}

export function commentErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) {
      return t("errors.comment.generic");
    }
    if (err.status === 401) {
      return t("errors.comment.unauthorized");
    }
    if (err.status === 403) {
      return t("errors.comment.forbidden");
    }
    if (err.status === 404) {
      return t("errors.comment.notFound");
    }
    return err.message || t("errors.comment.generic");
  }
  return t("errors.comment.generic");
}

/** Edit/delete failures. 403 is an ownership denial, not a "cannot comment" denial. */
export function commentActionErrorMessage(err: unknown, action: "edit" | "delete"): string {
  const failed =
    action === "edit" ? t("halls.comment.editFailed") : t("halls.comment.deleteFailed");
  if (err instanceof ApiError) {
    if (err.status === 401) return t("errors.comment.unauthorized");
    if (err.status === 403) return t("halls.comment.forbidden");
    if (err.status === 404) return t("halls.comment.notFound");
    return failed;
  }
  return failed;
}
