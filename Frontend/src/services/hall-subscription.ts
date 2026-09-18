import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import {
  mapHallSubscription,
  toHallSubscriptionError,
} from "@/lib/hall-subscription";
import type { HallSubscription } from "@/types/hall-subscription";

/**
 * wesal-api US-OWNER-17: GET /owner/halls/{hallId}/subscription
 */
export async function fetchHallSubscriptionStatus(
  hallId: string,
  signal?: AbortSignal,
): Promise<HallSubscription> {
  const id = hallId.trim();
  if (!id) {
    throw toHallSubscriptionError(new ApiError("errors.owner.subscription.notFound", 404));
  }

  try {
    const { data } = await api.get<unknown>(`/owner/halls/${id}/subscription`, {
      timeout: 8000,
      signal,
    });
    return mapHallSubscription(data, id);
  } catch (err) {
    throw toHallSubscriptionError(err);
  }
}
