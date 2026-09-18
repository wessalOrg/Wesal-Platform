import type { HallApprovalStatus } from "@/constants/hallApprovalStatus";
import {
  fromHallRegionApi,
  resolveOwnerMediaUrl,
} from "@/lib/hall-owner-api-region";
import { mapBackendHallStatus } from "@/lib/hall-owner-halls-mapper";
import type {
  ExistingHallPhoto,
  HallEditFormValues,
  HallEditability,
  HallOwnerHallDetails,
} from "@/types/hall-owner-hall-management";
import { EMPTY_BOOKING_PERIOD } from "@/types/hall-registration";

/**
 * wesal-api US-OWNER-07 contract:
 * GET /api/v1/owner/halls/{hallId}
 * PUT /api/v1/owner/halls/{hallId}  application/json (UpdateOwnerHallRequest)
 */
export const OWNER_HALL_DETAILS_PATH = (hallId: string) =>
  `/owner/halls/${encodeURIComponent(hallId)}`;

export const UPDATE_OWNER_HALL_PATH = OWNER_HALL_DETAILS_PATH;

export type OwnerHallPhotoDto = {
  id?: string | null;
  url?: string | null;
  displayOrder?: number | null;
};

export type OwnerHallBookingPeriodDto = {
  type?: string | number | null;
  startTime?: string | null;
  endTime?: string | null;
};

export type OwnerHallDetailsDto = {
  hallId?: string | null;
  hallName?: string | null;
  mainImageUrl?: string | null;
  contactPhone?: string | null;
  region?: string | number | null;
  regionDisplayName?: string | null;
  address?: string | null;
  description?: string | null;
  capacity?: number | null;
  price?: number | null;
  showPrice?: boolean | null;
  status?: string | number | null;
  isEditable?: boolean | null;
  photos?: OwnerHallPhotoDto[] | null;
  bookingPeriods?: OwnerHallBookingPeriodDto[] | null;
};

function normalizeTime(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  const match = value.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : value;
}

function parsePeriodType(raw: string | number | null | undefined): "first" | "second" | null {
  if (raw === 0 || raw === "0") return "first";
  if (raw === 1 || raw === "1") return "second";
  const normalized = String(raw ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();
  if (normalized === "firstperiod" || normalized === "first") return "first";
  if (normalized === "secondperiod" || normalized === "second") return "second";
  return null;
}

function readPeriods(dto: OwnerHallDetailsDto): {
  firstPeriod: { startTime: string; endTime: string };
  secondPeriod: { startTime: string; endTime: string };
} {
  const firstPeriod = { ...EMPTY_BOOKING_PERIOD };
  const secondPeriod = { ...EMPTY_BOOKING_PERIOD };
  const list = Array.isArray(dto.bookingPeriods) ? dto.bookingPeriods : [];
  for (const item of list) {
    const which = parsePeriodType(item.type);
    if (!which) continue;
    const period = {
      startTime: normalizeTime(item.startTime),
      endTime: normalizeTime(item.endTime),
    };
    if (which === "first") Object.assign(firstPeriod, period);
    else Object.assign(secondPeriod, period);
  }
  return { firstPeriod, secondPeriod };
}

function mapPhoto(dto: OwnerHallPhotoDto, index: number): ExistingHallPhoto | null {
  const url = String(dto.url ?? "").trim();
  if (!url) return null;
  const id = String(dto.id ?? "").trim() || `photo-${index}`;
  return {
    id,
    url: resolveOwnerMediaUrl(url),
    /** Original API path/URL for PUT UpdateOwnerHallPhotoDto.Url */
    apiUrl: url,
  };
}

/**
 * Prefer sending the API-relative path when we resolved an absolute URL for display.
 */
export function toOwnerPhotoApiUrl(photo: ExistingHallPhoto): string {
  const apiUrl = photo.apiUrl?.trim();
  if (apiUrl) return apiUrl;
  const url = photo.url.trim();
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5298/api/v1";
  const origin = apiBase.replace(/\/api\/v1\/?$/i, "");
  if (origin && url.startsWith(origin)) {
    return url.slice(origin.length) || url;
  }
  return url;
}

function mapPhotos(dto: OwnerHallDetailsDto): ExistingHallPhoto[] {
  const list = Array.isArray(dto.photos) ? dto.photos : [];
  const photos: ExistingHallPhoto[] = [];
  list.forEach((item, index) => {
    const mapped = mapPhoto(item, index);
    if (mapped) photos.push(mapped);
  });
  return photos;
}

/**
 * Backend: IsEditable = Status != PendingReview.
 * PendingReview → underReview; otherwise editable when IsEditable is true/omitted.
 */
export function resolveHallEditability(
  dto: OwnerHallDetailsDto,
  status: HallApprovalStatus,
): HallEditability {
  if (status === "Pending") return "underReview";
  if (dto.isEditable === false) return "locked";
  if (dto.isEditable === true) return "editable";
  // Match backend default: anything not PendingReview is editable.
  return "editable";
}

export function mapOwnerHallDetailsDto(
  data: unknown,
  fallbackId?: string,
): HallOwnerHallDetails | null {
  if (!data || typeof data !== "object") return null;
  const dto = data as OwnerHallDetailsDto;
  const id = String(dto.hallId ?? fallbackId ?? "").trim();
  if (!id) return null;

  const status =
    mapBackendHallStatus(String(dto.status ?? "")) ?? "Pending";
  const periods = readPeriods(dto);
  const region =
    fromHallRegionApi(dto.regionDisplayName) ||
    fromHallRegionApi(dto.region);

  return {
    id,
    name: String(dto.hallName ?? "").trim() || "—",
    status,
    editability: resolveHallEditability(dto, status),
    contactPhone: String(dto.contactPhone ?? "").trim(),
    region,
    address: String(dto.address ?? "").trim(),
    description: String(dto.description ?? "").trim(),
    capacity: typeof dto.capacity === "number" ? dto.capacity : 0,
    price:
      dto.price === null || dto.price === undefined
        ? null
        : Number(dto.price),
    showPrice: Boolean(dto.showPrice),
    mainImageUrl: dto.mainImageUrl
      ? resolveOwnerMediaUrl(String(dto.mainImageUrl))
      : null,
    photos: mapPhotos(dto),
    firstPeriod: periods.firstPeriod,
    secondPeriod: periods.secondPeriod,
  };
}

export function mapHallDetailsToEditForm(
  details: HallOwnerHallDetails,
): HallEditFormValues {
  return {
    hallName: details.name === "—" ? "" : details.name,
    ownerPhone: details.contactPhone,
    region: details.region,
    detailedAddress: details.address,
    description: details.description,
    guestCapacity: details.capacity > 0 ? String(details.capacity) : "",
    rentalPrice:
      details.price === null || details.price === undefined
        ? ""
        : String(details.price),
    firstPeriod: {
      startTime: details.firstPeriod.startTime || EMPTY_BOOKING_PERIOD.startTime,
      endTime: details.firstPeriod.endTime || EMPTY_BOOKING_PERIOD.endTime,
    },
    secondPeriod: {
      startTime: details.secondPeriod.startTime || EMPTY_BOOKING_PERIOD.startTime,
      endTime: details.secondPeriod.endTime || EMPTY_BOOKING_PERIOD.endTime,
    },
    existingPhotos: [...details.photos],
  };
}
