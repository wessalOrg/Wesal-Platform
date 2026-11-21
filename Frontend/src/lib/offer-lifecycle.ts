export type OfferTimeline = {
  startsAt: string | null;
  endsAt: string | null;
  stoppedAt?: string | null;
};

/** Public APIs omit scheduled rows and do not expose the next unseen start time. */
export const OFFER_DISCOVERY_REFRESH_MS = 60_000;
export const MAX_TIMEOUT_MS = 2_147_483_647;

export function nextOfferBoundary(offers: readonly OfferTimeline[], now: number): number | null {
  let next = Infinity;
  for (const offer of offers) {
    if (offer.stoppedAt) continue;
    const end = Date.parse(offer.endsAt ?? "");
    if (!Number.isFinite(end) || end <= now) continue;
    const start = Date.parse(offer.startsAt ?? "");
    if (Number.isFinite(start) && start > now) next = Math.min(next, start);
    next = Math.min(next, end);
  }
  return Number.isFinite(next) ? next : null;
}
