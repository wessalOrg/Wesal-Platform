import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { getAccessToken } from "@/lib/auth-token";
import {
  mapOwnerHallDetailsDto,
  OWNER_HALL_DETAILS_PATH,
  UPDATE_OWNER_HALL_PATH,
} from "@/lib/hall-owner-hall-management-mapper";
import {
  mapHallFormToUpdateHallRequest,
  type UpdateOwnerHallRequest,
} from "@/lib/hall-owner-hall-update-mapper";
import type {
  HallEditFormValues,
  HallOwnerHallDetails,
} from "@/types/hall-owner-hall-management";

function toUpdateHallFormData(
  values: HallEditFormValues,
  body: UpdateOwnerHallRequest,
): FormData {
  const formData = new FormData();
  formData.append("payload", JSON.stringify(body));
  if (values.mainPhoto) {
    formData.append("mainPhoto", values.mainPhoto, values.mainPhoto.name);
  }
  for (const photo of values.photos) {
    formData.append("photos", photo, photo.name);
  }
  return formData;
}

function dropJsonContentType() {
  return [
    (body: unknown, headers: Record<string, unknown>) => {
      if (typeof FormData !== "undefined" && body instanceof FormData) {
        delete headers["Content-Type"];
      }
      return body;
    },
  ];
}

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
    editability: "editable",
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
    editability: "editable" as const,
  };

  return {
    id: hallId,
    name: meta.name,
    status: meta.status,
    editability: meta.editability,
    contactPhone: "0599111111",
    region: "Gaza",
    address: "غزة — شارع الجلاء",
    detailedAddress: "حي الرمال",
    description: "قاعة تجريبية لمعاينة واجهة إدارة صاحب القاعة.",
    capacity: 200,
    price: 1500,
    showPrice: true,
    youtubeVideoUrl: "",
    features: ["تكييف", "كراسي جاهزة", "موقف سيارات"],
    otherFeatures: "",
    paymentStatus: "Unpaid",
    paymentReceiptUploadedAt: null,
    hasPaymentReceipt: false,
    mainImageUrl: null,
    photos: [],
    adminLocked: false,
    systemLocked: false,
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
 * Updates an owned hall (wesal-api US-OWNER-07).
 * PUT /api/v1/owner/halls/{hallId}
 * JSON when only existing photo URLs change; multipart when new cover/gallery files are picked.
 */
export async function updateOwnerHall(
  hallId: string,
  values: HallEditFormValues,
): Promise<HallOwnerHallDetails | null> {
  const body = mapHallFormToUpdateHallRequest(values);
  const hasNewFiles = Boolean(values.mainPhoto) || values.photos.length > 0;

  if (ownerHallManagementUsesMock()) {
    const current = buildDemoHallDetails(hallId);
    const keptPhotos = values.existingPhotos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      apiUrl: photo.apiUrl,
    }));
    const addedPhotos = values.photos.map((file, index) => ({
      id: `new-${file.name}-${file.lastModified}-${index}`,
      url: URL.createObjectURL(file),
    }));
    const coverUrl = values.mainPhoto
      ? URL.createObjectURL(values.mainPhoto)
      : values.coverPhotoUrl ?? addedPhotos[0]?.url ?? keptPhotos[0]?.url ?? null;
    return {
      ...current,
      name: body.name?.trim() || current.name,
      contactPhone: body.contactPhone?.trim() || current.contactPhone,
      address: body.address?.trim() || current.address,
      detailedAddress: body.detailedAddress?.trim() || current.detailedAddress,
      description: body.description?.trim() || current.description,
      capacity:
        typeof body.capacity === "number" ? body.capacity : current.capacity,
      price: typeof body.price === "number" ? body.price : current.price,
      youtubeVideoUrl:
        body.youtubeVideoUrl?.trim() || current.youtubeVideoUrl,
      photos: [...keptPhotos, ...addedPhotos],
      mainImageUrl: coverUrl,
      editability: current.editability === "locked" ? "locked" : "editable",
    };
  }

  try {
    const { data, status } = hasNewFiles
      ? await api.put<unknown>(
          UPDATE_OWNER_HALL_PATH(hallId),
          toUpdateHallFormData(values, body),
          {
            timeout: 30000,
            transformRequest: dropJsonContentType(),
          },
        )
      : await api.put<unknown>(UPDATE_OWNER_HALL_PATH(hallId), body, {
          timeout: 30000,
          headers: { "Content-Type": "application/json" },
        });

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
