/**
 * Central Hall-ID scoped query identities (US-OWNER-08).
 * The app uses custom hooks (not TanStack Query); these keys document
 * and stabilize Hall-scoped cache/fetch boundaries for future RQ migration.
 */
export const hallOwnerQueryKeys = {
  hallsList: () => ["hall-owner", "halls"] as const,
  hallDetails: (hallId: string) =>
    ["hall-owner", "hall-details", hallId] as const,
  hallStatus: (hallId: string) =>
    ["hall-owner", "hall-status", hallId] as const,
  hallBookingRequests: (hallId: string) =>
    ["hall-owner", "booking-requests", hallId] as const,
};

/** Active Hall selection comes from the route: /owner/halls/[hallId] */
export function ownerHallPath(hallId: string): string {
  return `/owner/halls/${encodeURIComponent(hallId)}`;
}

export function ownerHallSubscriptionPath(hallId: string): string {
  return `${ownerHallPath(hallId)}#hall-subscription-heading-${hallId}`;
}

export function ownerHallNotificationsPath(hallId: string): string {
  return `/owner/halls/${encodeURIComponent(hallId)}/notifications`;
}

export function parseOwnerHallIdFromPathname(pathname: string): string | null {
  const match = pathname.match(
    /^\/owner\/halls\/([^/]+)(?:\/notifications)?\/?$/,
  );
  if (!match) return null;
  let hallId: string;
  try {
    hallId = decodeURIComponent(match[1]);
  } catch {
    hallId = match[1];
  }
  if (!hallId || hallId === "add") return null;
  return hallId;
}

export function isOwnerHallNotificationsPath(pathname: string): boolean {
  return /^\/owner\/halls\/[^/]+\/notifications\/?$/.test(pathname);
}
