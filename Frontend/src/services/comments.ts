import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
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
    return "اكتبي تعليقك قبل الإرسال.";
  }
  if (body.length < COMMENT_MIN_LENGTH) {
    return `التعليق لازم يكون ${COMMENT_MIN_LENGTH} أحرف على الأقل.`;
  }
  if (body.length > COMMENT_MAX_LENGTH) {
    return `التعليق ما يتجاوز ${COMMENT_MAX_LENGTH} حرف.`;
  }
  return null;
}

export function formatCommentTimeAgo(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} يوم`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `منذ ${weeks} أسبوع`;
  return date.toLocaleDateString("ar-EG");
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
    author: data.author?.trim() || "مستخدم",
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
      return "التعليق غير صالح. راجعي النص وحاولي مرة أخرى.";
    }
    if (err.status === 401) {
      return "يجب تسجيل الدخول لإرسال تعليق.";
    }
    if (err.status === 403) {
      return "لا يمكنك التعليق على هذه القاعة من حسابك.";
    }
    if (err.status === 404) {
      return "تعذر العثور على القاعة.";
    }
    return err.message || "تعذر إرسال التعليق. حاولي مرة أخرى.";
  }
  return "تعذر إرسال التعليق. حاولي مرة أخرى.";
}
