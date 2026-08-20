import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { t } from "@/i18n";
import { getStoredUiLang } from "@/lib/language";
import type { HallReview } from "@/types/hall";

export const COMMENT_MIN_LENGTH = 3;
export const COMMENT_MAX_LENGTH = 1000;

export type HallComment = {
  commentId: string;
  hallId: string;
  author: string;
  body: string;
  createdAt: string;
};

type CommentResponse = {
  commentId?: string;
  id?: string;
  hallId?: string;
  author?: string;
  body?: string;
  createdAt?: string;
};

export function validateCommentBody(raw: string): string | null {
  const body = raw.trim();
  if (!body) {
    return t("halls.comment.emptyBody");
  }
  if (body.length < COMMENT_MIN_LENGTH) {
    return t("halls.comment.minLength", { count: COMMENT_MIN_LENGTH });
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
  return {
    commentId: String(data.commentId ?? data.id ?? `comment-${Date.now()}`),
    hallId: String(data.hallId ?? fallbackHallId),
    author: data.author?.trim() || t("common.user"),
    body: data.body ?? "",
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
    { hallId, body: body.trim() },
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
