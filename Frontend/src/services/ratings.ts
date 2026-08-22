import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { t } from "@/i18n";

export type HallRatingSummary = {
  hallId: string;
  averageRating: number;
  totalRatings: number;
  userRating: number | null;
};

export type RatingSubmitResult = {
  averageRating: number;
  totalRatings: number;
  value: number;
};

type SummaryResponse = {
  hallId?: string;
  averageRating?: number;
  totalRatings?: number;
  userRating?: number | null;
};

type RatingResponse = {
  averageRating?: number;
  totalRatings?: number;
  value?: number;
};

export async function fetchHallRatingSummary(
  hallId: string,
): Promise<HallRatingSummary | null> {
  try {
    const { data } = await api.get<SummaryResponse>(`/ratings/hall/${hallId}`, {
      timeout: 5000,
    });
    return {
      hallId: String(data.hallId ?? hallId),
      averageRating: data.averageRating ?? 0,
      totalRatings: data.totalRatings ?? 0,
      userRating: data.userRating ?? null,
    };
  } catch {
    return null;
  }
}

export async function submitHallRating(
  hallId: string,
  value: number,
  updateExisting: boolean,
): Promise<RatingSubmitResult> {
  const body = { hallId, value };
  try {
    const { data } = await api.request<RatingResponse>({
      url: "/ratings",
      method: updateExisting ? "PUT" : "POST",
      data: body,
      timeout: 8000,
    });
    return {
      averageRating: data.averageRating ?? 0,
      totalRatings: data.totalRatings ?? 0,
      value: data.value ?? value,
    };
  } catch (err) {
    if (!updateExisting && err instanceof ApiError && err.status === 409) {
      return submitHallRating(hallId, value, true);
    }
    throw err;
  }
}

export function ratingErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return t("errors.rating.unauthorized");
    }
    if (err.status === 403) {
      return t("errors.rating.forbidden");
    }
    if (err.status === 404) {
      return t("errors.rating.notFound");
    }
    if (err.status === 409) {
      return t("errors.rating.conflict");
    }
    return err.message || t("errors.rating.generic");
  }
  return t("errors.rating.generic");
}
