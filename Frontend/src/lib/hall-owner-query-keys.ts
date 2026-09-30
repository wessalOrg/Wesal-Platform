/**
 * Central Hall-ID scoped owner route builders (US-OWNER-08).
 * Active Hall selection comes from the route: /owner/halls/[hallId]
 */
export function ownerHallPath(hallId: string): string {
  return `/owner/halls/${encodeURIComponent(hallId)}`;
}

export function ownerHallSubscriptionPath(hallId: string): string {
  return `${ownerHallPath(hallId)}#hall-subscription-heading-${hallId}`;
}

export function ownerAdminMessagesPath(
  hallId?: string | null,
  conversationId?: string | null,
): string {
  const params = new URLSearchParams();
  params.set("contact", "admin");
  if (hallId?.trim()) params.set("hallId", hallId.trim());
  if (conversationId?.trim()) params.set("conversation_id", conversationId.trim());
  return `/owner/messages?${params.toString()}`;
}

export function ownerHallNotificationsPath(
  hallId: string,
  requestId?: string | null,
): string {
  const base = `/owner/halls/${encodeURIComponent(hallId)}/notifications`;
  const id = requestId?.trim();
  return id ? `${base}?request_id=${encodeURIComponent(id)}` : base;
}

export function ownerBookingsPath(requestId?: string | null, hallId?: string | null): string {
  const params = new URLSearchParams();
  if (hallId?.trim()) params.set("hallId", hallId.trim());
  if (requestId?.trim()) params.set("request_id", requestId.trim());
  const query = params.toString();
  return query ? `/owner/bookings?${query}` : "/owner/bookings";
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
