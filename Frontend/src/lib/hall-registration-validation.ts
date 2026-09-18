import { isHallRegion } from "@/constants/hallRegions";
import { isValidRegisterPhone } from "@/lib/register-validation";
import type {
  HallRegistrationFieldErrors,
  HallRegistrationFormValues,
} from "@/types/hall-registration";

function isPositiveInt(raw: string): boolean {
  if (!/^\d+$/.test(raw.trim())) return false;
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(value) && value > 0;
}

function isOptionalNonNegativeNumber(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === "") return true;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return false;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0;
}

function isTimeValue(raw: string): boolean {
  return /^\d{2}:\d{2}$/.test(raw.trim());
}

/** Client-side required checks only — backend remains authoritative. */
export function validateHallRegistrationForm(
  values: HallRegistrationFormValues,
): HallRegistrationFieldErrors {
  const errors: HallRegistrationFieldErrors = {};

  if (!values.hallName.trim()) {
    errors.hallName = "owner.management.addHall.errors.hallNameRequired";
  }

  const phone = values.ownerPhone.trim();
  if (!phone) {
    errors.ownerPhone = "owner.management.addHall.errors.phoneRequired";
  } else if (!isValidRegisterPhone(phone)) {
    errors.ownerPhone = "owner.management.addHall.errors.phoneInvalid";
  }

  if (!values.region || !isHallRegion(values.region)) {
    errors.region = "owner.management.addHall.errors.regionRequired";
  }

  if (!values.detailedAddress.trim()) {
    errors.detailedAddress = "owner.management.addHall.errors.addressRequired";
  }

  if (!values.description.trim()) {
    errors.description = "owner.management.addHall.errors.descriptionRequired";
  }

  if (!values.guestCapacity.trim()) {
    errors.guestCapacity = "owner.management.addHall.errors.capacityRequired";
  } else if (!isPositiveInt(values.guestCapacity)) {
    errors.guestCapacity = "owner.management.addHall.errors.capacityInvalid";
  }

  if (!isOptionalNonNegativeNumber(values.rentalPrice)) {
    errors.rentalPrice = "owner.management.addHall.errors.priceInvalid";
  }

  if (!isTimeValue(values.firstPeriod.startTime)) {
    errors["firstPeriod.startTime"] =
      "owner.management.addHall.errors.firstStartRequired";
  }
  if (!isTimeValue(values.firstPeriod.endTime)) {
    errors["firstPeriod.endTime"] =
      "owner.management.addHall.errors.firstEndRequired";
  }

  if (!isTimeValue(values.secondPeriod.startTime)) {
    errors["secondPeriod.startTime"] =
      "owner.management.addHall.errors.secondStartRequired";
  }
  if (!isTimeValue(values.secondPeriod.endTime)) {
    errors["secondPeriod.endTime"] =
      "owner.management.addHall.errors.secondEndRequired";
  }

  if (values.photos.length < 1) {
    errors.photos = "owner.management.addHall.errors.photosRequired";
  }

  return errors;
}
