import { isHallRegion } from "@/constants/hallRegions";
import { isValidRegisterPhone } from "@/lib/register-validation";
import type {
  HallEditFieldErrors,
  HallEditFormValues,
} from "@/types/hall-owner-hall-management";

function isPositiveInt(raw: string): boolean {
  if (!/^\d+$/.test(raw.trim())) return false;
  const value = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(value) && value > 0;
}

/** Empty is allowed. A provided price must be greater than zero, matching the update validator. */
function isOptionalPositivePrice(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === "") return true;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return false;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0;
}

const YOUTUBE_URL_PATTERN =
  /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)[A-Za-z0-9_-]{6,30}(?:\?[^\s#]*)?(?:#[^\s]*)?$/i;

/** Client-side checks for edit form — backend remains authoritative. */
export function validateHallEditForm(
  values: HallEditFormValues,
): HallEditFieldErrors {
  const errors: HallEditFieldErrors = {};

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

  if (!values.address.trim()) {
    errors.address = "owner.management.addHall.errors.addressRequired";
  } else if (values.address.trim().length > 100) {
    errors.address = "owner.management.addHall.errors.addressTooLong";
  }

  if (values.detailedAddress.trim().length > 150) {
    errors.detailedAddress = "owner.management.addHall.errors.detailedAddressTooLong";
  }

  if (!values.description.trim()) {
    errors.description = "owner.management.addHall.errors.descriptionRequired";
  }

  if (!values.guestCapacity.trim()) {
    errors.guestCapacity = "owner.management.addHall.errors.capacityRequired";
  } else if (!isPositiveInt(values.guestCapacity)) {
    errors.guestCapacity = "owner.management.addHall.errors.capacityInvalid";
  }

  if (!isOptionalPositivePrice(values.rentalPrice)) {
    errors.rentalPrice = "owner.management.addHall.errors.priceInvalid";
  }

  const youtube = values.youtubeVideoUrl.trim();
  if (youtube && !YOUTUBE_URL_PATTERN.test(youtube)) {
    errors.youtubeVideoUrl = "owner.management.addHall.errors.youtubeUrlInvalid";
  }

  if (values.features.some((feature) => !feature.trim())) {
    errors.features = "owner.management.addHall.errors.featuresInvalid";
  }

  if (values.otherFeatures.trim().length > 200) {
    errors.otherFeatures = "owner.management.addHall.errors.otherFeaturesTooLong";
  }

  const hasPersistedMedia =
    values.existingPhotos.length > 0 || Boolean(values.coverApiUrl || values.coverPhotoUrl);
  if (!hasPersistedMedia && values.photos.length < 1 && !values.mainPhoto) {
    errors.photos = "owner.management.addHall.errors.photosRequired";
  }

  return errors;
}
