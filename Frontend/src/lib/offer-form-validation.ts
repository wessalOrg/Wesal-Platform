import { datetimeLocalToIso, OFFER_CONTENT_MAX, parseOfferMoney, validateOfferDateRange, validateOfferPricePair } from "./offer-validation";
import { validateProfessionalPostImages } from "./professional-post-validation";

export type OfferField = "oldPrice" | "offerPrice" | "startsAt" | "endsAt" | "content" | "images";
export type OfferFieldErrors = Partial<Record<OfferField, string>>;
export type OfferValidationInput = {
  oldPrice: string;
  offerPrice: string;
  startsAt: string;
  endsAt: string;
  content?: string;
  images?: File[];
  existingImageCount?: number;
};

export function offerImageMetadataError(files: File[], existingCount = 0): string | null {
  const issue = validateProfessionalPostImages(files, { required: false, existingCount });
  return issue ? `offers.validation.image.${issue}` : null;
}

/** Field-specific feedback using the existing A05 date parsing and range rules. */
export function getOfferDateFieldErrors(input: Pick<OfferValidationInput, "startsAt" | "endsAt">, now = new Date()): Pick<OfferFieldErrors, "startsAt" | "endsAt"> {
  const errors: Pick<OfferFieldErrors, "startsAt" | "endsAt"> = {};
  if (!input.startsAt.trim()) errors.startsAt = "offers.validation.startRequired";
  else if (!datetimeLocalToIso(input.startsAt)) errors.startsAt = "offers.validation.startInvalid";
  if (!input.endsAt.trim()) errors.endsAt = "offers.validation.endRequired";
  else if (!datetimeLocalToIso(input.endsAt)) errors.endsAt = "offers.validation.endInvalid";
  if (!errors.startsAt && !errors.endsAt) {
    const dates = validateOfferDateRange(input.startsAt, input.endsAt, now);
    if (dates.issue === "endBeforeStart") errors.endsAt = "offers.validation.endAfterStart";
    if (dates.issue === "endNotFuture") errors.endsAt = "offers.validation.endNotFuture";
  }
  return errors;
}

/** Shared required offer fields and professional image validation. */
export function getOfferFieldErrors(input: OfferValidationInput, now = new Date()): OfferFieldErrors {
  const errors: OfferFieldErrors = {};
  const old = parseOfferMoney(input.oldPrice);
  const offer = parseOfferMoney(input.offerPrice);
  if (old.issue) errors.oldPrice = `offers.validation.money.${old.issue}`;
  if (offer.issue) errors.offerPrice = `offers.validation.money.${offer.issue}`;
  if (old.value != null && offer.value != null && validateOfferPricePair(old.value, offer.value)) {
    errors.offerPrice = "offers.validation.offerBelowOld";
  }
  Object.assign(errors, getOfferDateFieldErrors(input, now));
  if (input.content !== undefined) {
    const images = input.images ?? [];
    if (!input.content.trim() && images.length + (input.existingImageCount ?? 0) === 0) {
      errors.content = "offers.validation.contentOrImage";
    } else if (input.content.length > OFFER_CONTENT_MAX) errors.content = "offers.validation.titleMax";
    const issue = offerImageMetadataError(images, input.existingImageCount);
    if (issue) errors.images = issue;
  }
  return errors;
}

/** Same header checks as DocumentUploadValidator; no image decoding or backend changes. */
export async function validateOfferImageFiles(files: File[], existingCount = 0): Promise<string | null> {
  const metadataError = offerImageMetadataError(files, existingCount);
  if (metadataError) return metadataError;
  try {
    for (const file of files) {
      const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const matches = (signature: number[], offset = 0) => signature.every((byte, i) => header[offset + i] === byte);
      const type = file.type.toLowerCase();
      const valid = type === "image/jpeg" ? matches([0xff, 0xd8, 0xff])
        : type === "image/png" ? matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        : type === "image/webp" && matches([0x52, 0x49, 0x46, 0x46]) && matches([0x57, 0x45, 0x42, 0x50], 8);
      if (!valid) return "offers.validation.image.signature";
    }
  } catch { return "offers.validation.image.read"; }
  return null;
}
