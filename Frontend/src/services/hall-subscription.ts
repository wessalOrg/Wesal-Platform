import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { addUtcDays, utcTodayIso } from "@/lib/booking-date";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import {
  mapHallSubscription,
  toHallSubscriptionError,
} from "@/lib/hall-subscription";
import type { HallSubscription, HallSubscriptionStatus } from "@/types/hall-subscription";

/**
 * wesal-api US-OWNER-17: GET /owner/halls/{hallId}/subscription
 */

function subscriptionUsesMock(): boolean {
  if (!isDemoModeEnabled()) return false;
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

function buildDemoSubscription(hallId: string): HallSubscription {
  const id = hallId.trim();
  let status: HallSubscriptionStatus = "active";
  let daysRemaining = 27;
  let isPaid = true;
  const totalDays = 30;

  if (id.includes("pending") || id.includes("unpaid")) {
    status = "unpaid";
    daysRemaining = 0;
    isPaid = false;
  } else if (id.includes("rejected") || id.includes("expired")) {
    status = "expired";
    daysRemaining = 0;
    isPaid = false;
  } else if (id.includes("locked")) {
    status = "locked";
    daysRemaining = 0;
    isPaid = true;
  }

  const today = utcTodayIso();
  const expiresAt = status === "active" ? addUtcDays(today, daysRemaining) : null;
  const cycleStart =
    status === "active" ? addUtcDays(today, daysRemaining - totalDays) : null;

  return {
    hallId: id,
    status,
    subscriptionStatus: status,
    isPaid,
    billing:
      expiresAt != null
        ? { kind: "next", iso: expiresAt }
        : null,
    cycleStart,
    subscriptionExpiresAt: expiresAt,
    daysRemaining: status === "active" ? daysRemaining : null,
    expiryWarningDispatched: false,
  };
}

export async function fetchHallSubscriptionStatus(
  hallId: string,
  signal?: AbortSignal,
): Promise<HallSubscription> {
  const id = hallId.trim();
  if (!id) {
    throw toHallSubscriptionError(new ApiError("errors.owner.subscription.notFound", 404));
  }

  if (subscriptionUsesMock()) {
    return buildDemoSubscription(id);
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
