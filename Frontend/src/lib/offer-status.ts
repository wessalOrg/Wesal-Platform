import type { OfferLifecycleStatus } from "@/types/offers";

/**
 * Derive offer visibility state from API timestamps.
 * Active window is inclusive start, exclusive end (matches backend Discover).
 */
export function resolveOfferStatus(
  startsAt: string | Date | null | undefined,
  endsAt: string | Date | null | undefined,
  stoppedAt?: string | Date | null,
  now: Date = new Date(),
): OfferLifecycleStatus {
  if (stoppedAt) {
    const stopped = toDate(stoppedAt);
    if (stopped) return "stopped";
  }
  const start = toDate(startsAt);
  const end = toDate(endsAt);
  if (!start || !end) return "expired";
  const t = now.getTime();
  if (t >= end.getTime()) return "expired";
  if (t < start.getTime()) return "scheduled";
  return "active";
}

/** Public surfaces only show currently active (non-stopped) offers. */
export function isOfferPubliclyVisible(
  startsAt: string | Date | null | undefined,
  endsAt: string | Date | null | undefined,
  stoppedAt?: string | Date | null,
  now: Date = new Date(),
): boolean {
  return resolveOfferStatus(startsAt, endsAt, stoppedAt, now) === "active";
}

export function offerDiscountPercent(
  oldPrice: number,
  offerPrice: number,
): number | null {
  if (!Number.isFinite(oldPrice) || oldPrice <= 0) return null;
  if (!Number.isFinite(offerPrice) || offerPrice < 0) return null;
  if (offerPrice >= oldPrice) return null;
  return Math.round(((oldPrice - offerPrice) / oldPrice) * 100);
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
