import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import {
  mapOwnerHallDetailsDto,
  OWNER_HALL_DETAILS_PATH,
  UPDATE_OWNER_HALL_PATH,
} from "@/lib/hall-owner-hall-management-mapper";
import type { UpdateOwnerHallRequest } from "@/lib/hall-owner-hall-update-mapper";
import type { HallOwnerHallDetails } from "@/types/hall-owner-hall-management";

function ownerHallManagementUsesMock(): boolean {
  const token = getAccessToken();
  return !token || token.startsWith("stub-");
}

const DEMO_HALL_META: Record<
  string,
  Pick<HallOwnerHallDetails, "name" | "status" | "editability">
> = {
  "demo-hall-approved": {
    name: "قاعة النور",
    status: "Approved",
    editability: "editable",
  },
  "demo-hall-pending": {
    name: "قاعة الأمل",
    status: "Pending",
    editability: "underReview",
  },
  "demo-hall-rejected": {
    name: "قاعة الياسمين",
    status: "Rejected",
    editability: "editable",
  },
};

function buildDemoHallDetails(hallId: string): HallOwnerHallDetails {
  const meta = DEMO_HALL_META[hallId] ?? {
    name: "قاعة تجريبية",
    status: "Pending" as const,
    editability: "underReview" as const,
  };

  return {
    id: hallId,
    name: meta.name,
    status: meta.status,
    editability: meta.editability,
    contactPhone: "0599111111",
    region: "Gaza",
    address: "غزة — شارع الجلاء",
    description: "قاعة تجريبية لمعاينة واجهة إدارة صاحب القاعة.",
    capacity: 200,
    price: 1500,
    showPrice: true,
    mainImageUrl: null,
    photos: [],
    firstPeriod: { startTime: "10:00", endTime: "14:00" },
    secondPeriod: { startTime: "16:00", endTime: "22:00" },
  };
}

/**
 * Fetches current management details for one owned hall (server source of truth).
 * GET /api/v1/owner/halls/{hallId}
 */
export async function fetchOwnerHallDetails(
  hallId: string,
): Promise<HallOwnerHallDetails> {
  if (ownerHallManagementUsesMock()) {
    return buildDemoHallDetails(hallId);
  }

  try {
    const { data } = await api.get<unknown>(OWNER_HALL_DETAILS_PATH(hallId), {
      timeout: 10000,
    });
    const mapped = mapOwnerHallDetailsDto(data, hallId);
    if (!mapped) {
      throw new ApiError("owner.management.hallEdit.errors.notFound", 404);
    }
    return mapped;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error
        ? err.message
        : "owner.management.hallEdit.errors.loadFailed",
      0,
    );
  }
}

/**
 * Updates an owned hall via JSON UpdateOwnerHallRequest (wesal-api US-OWNER-07).
 * PUT /api/v1/owner/halls/{hallId}  application/json
 */
export async function updateOwnerHall(
  hallId: string,
  body: UpdateOwnerHallRequest,
): Promise<HallOwnerHallDetails | null> {
  if (ownerHallManagementUsesMock()) {
    const current = buildDemoHallDetails(hallId);
    return {
      ...current,
      name: body.name?.trim() || current.name,
      contactPhone: body.contactPhone?.trim() || current.contactPhone,
      address: body.address?.trim() || current.address,
      description: body.description?.trim() || current.description,
      capacity:
        typeof body.capacity === "number" ? body.capacity : current.capacity,
      price: typeof body.price === "number" ? body.price : current.price,
    };
  }

  try {
    const { data, status } = await api.put<unknown>(
      UPDATE_OWNER_HALL_PATH(hallId),
      body,
      {
        timeout: 30000,
        headers: { "Content-Type": "application/json" },
      },
    );

    if (status === 204 || data === "" || data == null) {
      return null;
    }

    return mapOwnerHallDetailsDto(data, hallId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      err instanceof Error
        ? err.message
        : "owner.management.hallEdit.errors.submitFailed",
      0,
    );
  }
}
