/** Shared price/date rules for professional + hall offers (PublishingContentValidators). */
export const OFFER_CONTENT_MAX = 2000;
export const OFFER_MAX_MONEY = 9_999_999_999.99;
export const OFFER_IMAGES_MAX = 10;
export const OFFER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const OFFER_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export type OfferMoneyIssue = "required" | "invalid" | "nonPositive" | "tooLarge" | "decimals";
export type OfferDateIssue = "required" | "invalid" | "endBeforeStart" | "endNotFuture";

export function parseOfferMoney(
  raw: string,
  options?: { required?: boolean },
): { value: number | null; issue: OfferMoneyIssue | null } {
  const required = options?.required ?? true;
  const trimmed = raw.trim();
  if (!trimmed) {
    return required ? { value: null, issue: "required" } : { value: null, issue: null };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { value: null, issue: "invalid" };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { value: null, issue: "invalid" };
  if (value <= 0) return { value: null, issue: "nonPositive" };
  if (value > OFFER_MAX_MONEY) return { value: null, issue: "tooLarge" };
  if (Math.round(value * 100) / 100 !== value) return { value: null, issue: "decimals" };
  return { value, issue: null };
}

/** Optional non-negative money (PriceBox / IsMoney — 0 allowed). */
export function parseOptionalOfferMoney(
  raw: string,
): { value: number | null; issue: OfferMoneyIssue | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, issue: null };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { value: null, issue: "invalid" };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { value: null, issue: "invalid" };
  if (value < 0) return { value: null, issue: "nonPositive" };
  if (value > OFFER_MAX_MONEY) return { value: null, issue: "tooLarge" };
  if (Math.round(value * 100) / 100 !== value) return { value: null, issue: "decimals" };
  return { value, issue: null };
}

export function validateOfferPricePair(
  oldPrice: number,
  offerPrice: number,
): "offerNotLower" | null {
  if (!(offerPrice < oldPrice)) return "offerNotLower";
  return null;
}

export function calculateOfferDiscountPercent(
  oldPrice: number,
  offerPrice: number,
): number | null {
  if (!(oldPrice > 0) || !Number.isFinite(oldPrice) || !Number.isFinite(offerPrice)) {
    return null;
  }
  if (offerPrice >= oldPrice) return null;
  return Math.round(((oldPrice - offerPrice) / oldPrice) * 1000) / 10;
}

/** datetime-local value → ISO string for DateTimeOffset binding. */
export function datetimeLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function isoToDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function validateOfferDateRange(
  startsLocal: string,
  endsLocal: string,
  now = new Date(),
): { startsAt: string | null; endsAt: string | null; issue: OfferDateIssue | null } {
  if (!startsLocal.trim()) {
    return { startsAt: null, endsAt: null, issue: "required" };
  }
  if (!endsLocal.trim()) {
    return { startsAt: null, endsAt: null, issue: "required" };
  }
  const startsAt = datetimeLocalToIso(startsLocal);
  const endsAt = datetimeLocalToIso(endsLocal);
  if (!startsAt || !endsAt) {
    return { startsAt: null, endsAt: null, issue: "invalid" };
  }
  const startMs = Date.parse(startsAt);
  const endMs = Date.parse(endsAt);
  if (!(endMs > startMs)) {
    return { startsAt, endsAt, issue: "endBeforeStart" };
  }
  if (!(endMs > now.getTime())) {
    return { startsAt, endsAt, issue: "endNotFuture" };
  }
  return { startsAt, endsAt, issue: null };
}

export type OfferLifecycleStatus = "scheduled" | "active" | "expired" | "stopped";

export function deriveOfferLifecycleStatus(input: {
  startsAt: string | null;
  endsAt: string | null;
  stoppedAt: string | null;
  now?: Date;
}): OfferLifecycleStatus {
  const now = input.now ?? new Date();
  if (input.stoppedAt) return "stopped";
  const ends = input.endsAt ? Date.parse(input.endsAt) : NaN;
  if (Number.isFinite(ends) && ends <= now.getTime()) return "expired";
  const starts = input.startsAt ? Date.parse(input.startsAt) : NaN;
  if (Number.isFinite(starts) && starts > now.getTime()) return "scheduled";
  return "active";
}

export function canStopOffer(status: OfferLifecycleStatus): boolean {
  return status === "active" || status === "scheduled";
}
