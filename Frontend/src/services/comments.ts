import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { t } from "@/i18n";
import { getStoredUiLang } from "@/lib/language";
import type { HallReview } from "@/types/hall";

/** Mirrors the API rule: content must be non-blank and at most this long. */
export const COMMENT_MAX_LENGTH = 1000;

export type HallComment = {
  commentId: string;
  hallId: string;
  author: string;
  body: string;
  createdAt: string;
};

/** Mirrors the API `CommentResponse` contract exactly. */
type CommentResponse = {
  commentId?: string;
  hallId?: string;
  content?: string;
  userName?: string;
  createdAt?: string;
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
  };
}

function mapResponse(data: CommentResponse, fallbackHallId: string): HallComment {
  const author = (data.userName ?? "").trim();
  return {
    commentId: String(data.commentId ?? `comment-${Date.now()}`),
    hallId: String(data.hallId ?? fallbackHallId),
    // The hall comments list omits the writer name, so fall back to a neutral label.
    author: author ? decodeHtmlEntities(author) : t("common.user"),
    body: decodeHtmlEntities(data.content ?? ""),
    createdAt: data.createdAt ?? new Date().toISOString(),
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
