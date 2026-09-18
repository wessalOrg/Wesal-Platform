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
 *   name, contactPhone, region, address, description, capacity,
 *   price (omit when empty), firstPeriodStart, firstPeriodEnd,
 *   secondPeriodStart, secondPeriodEnd, photos (repeat), initiationId?
 *
 * Region display strings: North Gaza | Gaza | Middle Area | South Gaza
 * Period times: HH:mm (TimeOnly-compatible)
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
 * Empty rental price is omitted (not sent as 0).
 */
export function mapHallFormToCreateHallRequest(
  values: HallRegistrationFormValues,
  options: MapHallFormOptions = {},
): FormData {
  const formData = new FormData();

  formData.append("name", values.hallName.trim());
  formData.append("contactPhone", normalizeRegisterPhone(values.ownerPhone));
  formData.append("region", values.region);
  formData.append("address", values.detailedAddress.trim());
  formData.append("description", values.description.trim());
  formData.append("capacity", String(Number.parseInt(values.guestCapacity.trim(), 10)));

  const priceRaw = values.rentalPrice.trim();
  if (priceRaw !== "") {
    formData.append("price", priceRaw);
  }

  formData.append("firstPeriodStart", values.firstPeriod.startTime.trim());
  formData.append("firstPeriodEnd", values.firstPeriod.endTime.trim());
  formData.append("secondPeriodStart", values.secondPeriod.startTime.trim());
  formData.append("secondPeriodEnd", values.secondPeriod.endTime.trim());

  appendIfPresent(formData, "initiationId", options.initiationId ?? "");

  for (const photo of values.photos) {
    formData.append("photos", photo, photo.name);
  }

  return formData;
}
