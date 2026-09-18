import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import {
  mapOwnerHallBookingRequestsResponse,
  OWNER_HALL_BOOKING_REQUESTS_PATH,
} from "@/lib/owner-hall-booking-requests-mapper";
import type { OwnerHallBookingRequest } from "@/types/owner-hall-booking-requests";

function ownerBookingRequestsUsesMock(): boolean {
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

function buildDemoBookingRequests(
  hallId: string,
): OwnerHallBookingRequest[] {
  return [
    {
      id: `demo-req-${hallId}-1`,
      hallId,
      requesterName: "سارة محمود",
      date: "2026-09-20",
      periods: ["FirstPeriod"],
      status: "Pending",
      createdAt: "2026-09-10T10:00:00.000Z",
    },
    {
      id: `demo-req-${hallId}-2`,
      hallId,
      requesterName: "أحمد خالد",
      date: "2026-09-25",
      periods: ["SecondPeriod"],
      status: "Accepted",
      createdAt: "2026-09-08T14:30:00.000Z",
    },
  ];
}

/**
 * Fetches incoming booking requests for one owned hall (US-OWNER-09).
 * Server response is authoritative — no client-side cross-hall filtering.
 */
export async function fetchOwnerHallBookingRequests(
  hallId: string,
): Promise<OwnerHallBookingRequest[]> {
  if (ownerBookingRequestsUsesMock()) {
    return buildDemoBookingRequests(hallId);
  }

  try {
    const { data } = await api.get<unknown>(
      OWNER_HALL_BOOKING_REQUESTS_PATH(hallId),
      { timeout: 10000 },
    );
    return mapOwnerHallBookingRequestsResponse(data, hallId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error
        ? err.message
        : "owner.management.notifications.errors.loadFailed",
      0,
    );
  }
}
