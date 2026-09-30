import { toHallPaymentStatus } from "@/constants/hallPaymentStatus";
import { normalizeTimeOnly } from "@/lib/hourly-slots";
import {
  fromHallRegionApi,
  resolveOwnerMediaUrl,
} from "@/lib/hall-owner-api-region";
import { hallAccessFromUnknown } from "@/lib/hall-access";
import { apiUploadPath } from "@/lib/hall-media-url";
import { mapBackendHallStatus } from "@/lib/hall-owner-halls-mapper";
import type {
  ExistingHallPhoto,
  HallEditFormValues,
  HallEditability,
  HallOwnerHallDetails,
} from "@/types/hall-owner-hall-management";

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

export type OwnerHallDetailsDto = {
  hallId?: string | null;
  hallName?: string | null;
  mainImageUrl?: string | null;
  contactPhone?: string | null;
  region?: string | number | null;
  regionDisplayName?: string | null;
  address?: string | null;
  detailedAddress?: string | null;
  description?: string | null;
  capacity?: number | null;
  price?: number | null;
  showPrice?: boolean | null;
  youtubeVideoUrl?: string | null;
  features?: unknown;
  otherFeatures?: string | null;
  status?: string | number | null;
  paymentStatus?: string | number | boolean | null;
  paymentReceiptUploadedAt?: string | null;
  hasPaymentReceipt?: boolean | null;
  hourlySlotStart?: string | null;
  hourlySlotEnd?: string | null;
  isEditable?: boolean | null;
  isPaid?: boolean | null;
  paid?: boolean | null;
  adminLocked?: boolean | null;
  isAdminLocked?: boolean | null;
  systemLocked?: boolean | null;
  isSystemLocked?: boolean | null;
  photos?: OwnerHallPhotoDto[] | null;
};

function mapPhoto(dto: OwnerHallPhotoDto, index: number): ExistingHallPhoto | null {
  const record = dto as OwnerHallPhotoDto & Record<string, unknown>;
  const url = String(dto.url ?? record.Url ?? "").trim();
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
 * Media URL to echo back on PUT: always the API-relative `/uploads/...` path for
 * API uploads (even when the stored value was a legacy absolute URL), otherwise
 * the value unchanged. Keeps stored references origin-free (backend Edit 29).
 */
export function toOwnerMediaApiUrl(url: string): string {
  const value = url.trim();
  return apiUploadPath(value) ?? value;
}

/**
 * Prefer the original API value over the resolved display URL.
 */
export function toOwnerPhotoApiUrl(photo: ExistingHallPhoto): string {
  return toOwnerMediaApiUrl(photo.apiUrl?.trim() || photo.url);
}

function mapPhotos(dto: OwnerHallDetailsDto): ExistingHallPhoto[] {
  const record = dto as OwnerHallDetailsDto & Record<string, unknown>;
  const raw = dto.photos ?? record.Photos;
  const list = Array.isArray(raw) ? (raw as OwnerHallPhotoDto[]) : [];
  const photos: ExistingHallPhoto[] = [];
  list.forEach((item, index) => {
    const mapped = mapPhoto(item, index);
    if (mapped) photos.push(mapped);
  });
  return photos;
}

/**
 * Backend: IsEditable is independent of approval status (Pending/Approved/Rejected).
 */
export function resolveHallEditability(
  dto: OwnerHallDetailsDto,
): HallEditability {
  if (dto.isEditable === false) return "locked";
  return "editable";
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function readHour(value: unknown): string | null {
  const normalized = normalizeTimeOnly(value);
  return normalized || null;
}

function readPaymentReceiptUploadedAt(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  return value || null;
}

export function mapOwnerHallDetailsDto(
  data: unknown,
  fallbackId?: string,
): HallOwnerHallDetails | null {
  if (!data || typeof data !== "object") return null;
  const dto = data as OwnerHallDetailsDto;
  const id = String(dto.hallId ?? fallbackId ?? "").trim();
  if (!id) return null;

  const record = dto as OwnerHallDetailsDto & Record<string, unknown>;
  const status =
    mapBackendHallStatus(String(dto.status ?? record.Status ?? "")) ?? "Pending";
  const access = hallAccessFromUnknown(dto);
  const region =
    fromHallRegionApi(dto.regionDisplayName) ||
    fromHallRegionApi(
      dto.region ?? (record.Region as string | number | null | undefined),
    );
  const rawCover = String(dto.mainImageUrl ?? record.MainImageUrl ?? "").trim();

  return {
    id,
    name: String(dto.hallName ?? "").trim() || "—",
    status,
    editability: resolveHallEditability(dto),
    contactPhone: String(dto.contactPhone ?? "").trim(),
    region,
    address: String(dto.address ?? "").trim(),
    detailedAddress: String(dto.detailedAddress ?? "").trim(),
    description: String(dto.description ?? "").trim(),
    capacity: typeof dto.capacity === "number" ? dto.capacity : 0,
    price:
      dto.price === null || dto.price === undefined
        ? null
        : Number(dto.price),
    showPrice: Boolean(dto.showPrice),
    youtubeVideoUrl: String(dto.youtubeVideoUrl ?? "").trim(),
    features: readStringList(dto.features),
    otherFeatures: String(dto.otherFeatures ?? "").trim(),
    paymentStatus: toHallPaymentStatus(dto.paymentStatus) ?? "Unpaid",
    paymentReceiptUploadedAt: readPaymentReceiptUploadedAt(
      dto.paymentReceiptUploadedAt,
    ),
    hasPaymentReceipt: Boolean(dto.hasPaymentReceipt),
    mainImageUrl: rawCover ? resolveOwnerMediaUrl(rawCover) : null,
    mainImageApiUrl: rawCover || null,
    hourlySlotStart: readHour(dto.hourlySlotStart ?? record.HourlySlotStart),
    hourlySlotEnd: readHour(dto.hourlySlotEnd ?? record.HourlySlotEnd),
    photos: mapPhotos(dto),
    adminLocked: access.adminLocked,
    systemLocked: access.systemLocked,
  };
}

export function mapHallDetailsToEditForm(
  details: HallOwnerHallDetails,
): HallEditFormValues {
  return {
    hallName: details.name === "—" ? "" : details.name,
    ownerPhone: details.contactPhone,
    region: details.region,
    address: details.address,
    detailedAddress: details.detailedAddress,
    description: details.description,
    guestCapacity: details.capacity > 0 ? String(details.capacity) : "",
    rentalPrice:
      details.price === null || details.price === undefined
        ? ""
        : String(details.price),
    youtubeVideoUrl: details.youtubeVideoUrl,
    features: [...details.features],
    otherFeatures: details.otherFeatures,
    existingPhotos: [...details.photos],
    coverPhotoUrl: details.mainImageUrl ?? (details.photos[0]?.url ?? null),
    coverApiUrl:
      details.mainImageApiUrl ?? details.photos[0]?.apiUrl ?? details.photos[0]?.url ?? null,
    hourlySlotStart: details.hourlySlotStart,
    hourlySlotEnd: details.hourlySlotEnd,
    mainPhoto: null,
    photos: [],
  };
}
