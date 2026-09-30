import { toHallRegionApi, toTimeOnlyApi } from "@/lib/hall-owner-api-region";
import {
  toOwnerMediaApiUrl,
  toOwnerPhotoApiUrl,
} from "@/lib/hall-owner-hall-management-mapper";
import { normalizeTimeOnly } from "@/lib/hourly-slots";
import { normalizeRegisterPhone } from "@/lib/register-validation";
import type { HallEditFormValues } from "@/types/hall-owner-hall-management";

export type UpdateOwnerHallPhotoDto = {
  url: string;
  displayOrder: number;
};

/**
 * wesal-api UpdateOwnerHallRequest (JSON).
 * New files are sent on the same PUT as multipart (`payload` + mainPhoto + photos).
 */
export type UpdateOwnerHallRequest = {
  name: string;
  mainImageUrl: string | null;
  contactPhone: string | null;
  region: string;
  address: string;
  detailedAddress: string | null;
  description: string | null;
  capacity: number;
  price: number | null;
  showPrice: boolean;
  youtubeVideoUrl: string | null;
  features: string[];
  otherFeatures: string | null;
  photos: UpdateOwnerHallPhotoDto[];
  hourlySlotStart: string | null;
  hourlySlotEnd: string | null;
};

/**
 * Builds the JSON update payload matching wesal-api UpdateOwnerHallRequest.
 */
export function mapHallFormToUpdateHallRequest(
  values: HallEditFormValues,
): UpdateOwnerHallRequest {
  const region = toHallRegionApi(values.region);
  if (!region) {
    throw new Error("owner.management.addHall.errors.regionRequired");
  }

  const photos: UpdateOwnerHallPhotoDto[] = values.existingPhotos.map(
    (photo, index) => ({
      url: toOwnerPhotoApiUrl(photo),
      displayOrder: index,
    }),
  );

  const coverUrl = resolveCoverApiUrl(values);
  if (photos.length === 0 && coverUrl && !values.mainPhoto && values.photos.length === 0) {
    photos.push({ url: coverUrl, displayOrder: 0 });
  }

  const priceRaw = values.rentalPrice.trim();
  const price = priceRaw === "" ? null : Number.parseFloat(priceRaw);

  return {
    name: values.hallName.trim(),
    mainImageUrl: coverUrl ?? photos[0]?.url ?? null,
    contactPhone: normalizeRegisterPhone(values.ownerPhone) || null,
    region,
    address: values.address.trim(),
    detailedAddress: values.detailedAddress.trim() || null,
    description: values.description.trim() || null,
    capacity: Number.parseInt(values.guestCapacity.trim(), 10),
    price: Number.isFinite(price as number) ? (price as number) : null,
    showPrice: priceRaw !== "",
    youtubeVideoUrl: values.youtubeVideoUrl.trim() || null,
    features: values.features,
    otherFeatures: values.otherFeatures.trim() || null,
    photos,
    hourlySlotStart: toWholeHourApi(values.hourlySlotStart),
    hourlySlotEnd: toWholeHourApi(values.hourlySlotEnd),
  };
}

function resolveCoverApiUrl(values: HallEditFormValues): string | null {
  const selected = values.existingPhotos.find((photo) => photo.url === values.coverPhotoUrl);
  if (selected) return toOwnerPhotoApiUrl(selected);
  const stored = values.coverApiUrl?.trim();
  return stored ? toOwnerMediaApiUrl(stored) : null;
}

function toWholeHourApi(value: string | null): string | null {
  const normalized = normalizeTimeOnly(value ?? "");
  if (!normalized) return null;
  return toTimeOnlyApi(normalized);
}
