import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import { mapHallOwnerHallsResponse } from "@/lib/hall-owner-halls-mapper";
import type { HallOwnerHall } from "@/types/hall-owner-halls";

/**
 * Assumed until Mohammed/Abdulaziz publish the final owner-halls OpenAPI:
 * GET /api/v1/owner/halls
 */
export const OWNER_HALLS_PATH = "/owner/halls";

const DEMO_OWNER_HALLS: HallOwnerHall[] = [
  {
    id: "demo-hall-approved",
    name: "قاعة النور",
    status: "Approved",
    expiryWarning: null,
    paymentStatus: "Paid",
    adminLocked: false,
    systemLocked: false,
  },
  {
    id: "demo-hall-pending",
    name: "قاعة الأمل",
    status: "Pending",
    expiryWarning: null,
    paymentStatus: "Unpaid",
    adminLocked: false,
    systemLocked: false,
  },
  {
    id: "demo-hall-rejected",
    name: "قاعة الياسمين",
    status: "Rejected",
    expiryWarning: null,
    paymentStatus: "Unpaid",
    adminLocked: false,
    systemLocked: false,
  },
];

function ownerHallsUsesMock(): boolean {
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

/**
 * Fetches the authenticated Hall Owner's halls with live approval statuses.
 * Server response is the source of truth — no local Pending defaults.
 */
export async function fetchHallOwnerHalls(): Promise<HallOwnerHall[]> {
  if (ownerHallsUsesMock()) {
    return DEMO_OWNER_HALLS.map((hall) => ({ ...hall }));
  }

  try {
    const { data } = await api.get<unknown>(OWNER_HALLS_PATH, { timeout: 10000 });
    return mapHallOwnerHallsResponse(data);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error ? err.message : "owner.management.halls.loadError",
      0,
    );
  }
}
