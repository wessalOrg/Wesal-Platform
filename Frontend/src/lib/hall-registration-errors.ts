import { ApiError, isUnauthorizedApiError } from "@/lib/api-error";
import type {
  HallRegistrationFieldErrors,
  HallRegistrationFieldPath,
} from "@/types/hall-registration";

export { isUnauthorizedApiError };

/**
 * Maps ASP.NET ValidationProblemDetails keys onto form field paths.
 * Aliases cover camelCase, PascalCase, and nested period naming variants.
 */
const FIELD_ALIASES: Record<string, HallRegistrationFieldPath> = {
  name: "hallName",
  hallname: "hallName",
  contactphone: "ownerPhone",
  ownerphone: "ownerPhone",
  phone: "ownerPhone",
  phonenumber: "ownerPhone",
  region: "region",
  address: "detailedAddress",
  detailedaddress: "detailedAddress",
  description: "description",
  features: "description",
  capacity: "guestCapacity",
  guestcapacity: "guestCapacity",
  price: "rentalPrice",
  rentalprice: "rentalPrice",
  photos: "photos",
  photo: "photos",
  images: "photos",
  firstperiod: "firstPeriod",
  firstperiodstart: "firstPeriod.startTime",
  firstperiodstarttime: "firstPeriod.startTime",
  firstperiodend: "firstPeriod.endTime",
  firstperiodendtime: "firstPeriod.endTime",
  bookingperiods0starttime: "firstPeriod.startTime",
  bookingperiods0endtime: "firstPeriod.endTime",
  bookingperiods1starttime: "secondPeriod.startTime",
  bookingperiods1endtime: "secondPeriod.endTime",
  secondperiod: "secondPeriod",
  secondperiodstart: "secondPeriod.startTime",
  secondperiodstarttime: "secondPeriod.startTime",
  secondperiodend: "secondPeriod.endTime",
  secondperiodendtime: "secondPeriod.endTime",
};

function normalizeAliasKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function mapHallApiErrorsToFormErrors(
  error: ApiError,
): HallRegistrationFieldErrors {
  const mapped: HallRegistrationFieldErrors = {};

  for (const [key, messages] of Object.entries(error.fieldErrors)) {
    const message = messages[0]?.trim();
    if (!message) continue;
    const field = FIELD_ALIASES[normalizeAliasKey(key)];
    if (!field) continue;
    if (!mapped[field]) mapped[field] = message;
  }

  return mapped;
}

export function hallRegistrationSubmitErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return "owner.management.addHall.errors.network";
    if (Object.keys(error.fieldErrors).length > 0) {
      return "owner.management.addHall.errors.validation";
    }
    const detail = (error.detail ?? error.message).trim();
    if (detail) return detail;
  }
  return "owner.management.addHall.errors.submitFailed";
}
