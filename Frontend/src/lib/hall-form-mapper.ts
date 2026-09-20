import { toHallRegionApi } from "@/lib/hall-owner-api-region";
import type { HallRegistrationFormValues } from "@/types/hall-registration";
import { normalizeRegisterPhone } from "@/lib/register-validation";

/**
 * Create Hall multipart contract (wesal-api OwnerController).
 *
 * POST /api/v1/owner/halls
 * Auth: Bearer (Hall Owner)
 * Content-Type: multipart/form-data
 *
 * Fields:
 *   name, contactPhone, region (HallRegion enum name), address, detailedAddress?,
 *   description, capacity, price? (omit when empty), youtubeVideoUrl?,
 *   features (JSON string[] in one field — the controller splits it), otherFeatures?,
 *   firstPeriodStart, firstPeriodEnd, secondPeriodStart, secondPeriodEnd,
 *   mainPhoto (single file, cover promoted to MainImageUrl), photos (repeat)
 *
 * Region values: NorthGaza | Gaza | MiddleArea | SouthGaza (enum names).
 * Period times: HH:mm (TimeOnly-compatible).
 */
export const CREATE_HALL_PATH = "/owner/halls";

export type MapHallFormOptions = {
  initiationId?: string | null;
};

function appendIfPresent(formData: FormData, key: string, value: string) {
  const trimmed = value.trim();
  if (trimmed) formData.append(key, trimmed);
}

/**
 * Builds multipart FormData from UI values without mutating the form state.
 * Empty optional fields are omitted (not sent as empty strings).
 */
export function mapHallFormToCreateHallRequest(
  values: HallRegistrationFormValues,
  options: MapHallFormOptions = {},
): FormData {
  const formData = new FormData();
  const region = toHallRegionApi(values.region);

  formData.append("name", values.hallName.trim());
  formData.append("contactPhone", normalizeRegisterPhone(values.ownerPhone));
  formData.append("region", region ?? values.region.trim());
  formData.append("address", values.address.trim());
  formData.append("description", values.description.trim());
  formData.append("capacity", String(Number.parseInt(values.guestCapacity.trim(), 10)));

  const priceRaw = values.rentalPrice.trim();
  if (priceRaw !== "") {
    formData.append("price", priceRaw);
  }

  appendIfPresent(formData, "detailedAddress", values.detailedAddress);
  appendIfPresent(formData, "youtubeVideoUrl", values.youtubeVideoUrl);
  appendIfPresent(formData, "otherFeatures", values.otherFeatures);

  if (values.features.length > 0) {
    formData.append("features", JSON.stringify(values.features));
  }

  formData.append("firstPeriodStart", values.firstPeriod.startTime.trim());
  formData.append("firstPeriodEnd", values.firstPeriod.endTime.trim());
  formData.append("secondPeriodStart", values.secondPeriod.startTime.trim());
  formData.append("secondPeriodEnd", values.secondPeriod.endTime.trim());

  if (values.mainPhoto) {
    formData.append("mainPhoto", values.mainPhoto, values.mainPhoto.name);
  }

  appendIfPresent(formData, "initiationId", options.initiationId ?? "");

  for (const photo of values.photos) {
    formData.append("photos", photo, photo.name);
  }

  return formData;
}