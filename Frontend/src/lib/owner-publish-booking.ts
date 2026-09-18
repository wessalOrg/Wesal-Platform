import type { HallBookingNotification } from "@/types/hall-notifications";

export function readOptionalBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true" || value === "True") return true;
  if (value === 0 || value === "0" || value === "false" || value === "False") return false;
  return undefined;
}

function normalizedFlag(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");
}

export function parsePublishedFlag(data: {
  isPublished?: unknown;
  published?: unknown;
  publicationStatus?: unknown;
  status?: string | number | null;
}): boolean {
  if (readOptionalBool(data.isPublished ?? data.published) === true) return true;
  const publication = normalizedFlag(data.publicationStatus);
  if (publication === "published" || publication === "booked") return true;
  const status = normalizedFlag(data.status);
  return (
    status === "fullybooked" ||
    status === "published" ||
    status === "booked"
  );
}

export function parseCanPublishFlag(data: {
  canPublish?: unknown;
  isPublishable?: unknown;
  eligibleForPublication?: unknown;
  canBePublished?: unknown;
  readyToPublish?: unknown;
  depositsConfirmed?: unknown;
  bothDepositsConfirmed?: unknown;
  publicationStatus?: unknown;
}): boolean {
  const explicit = readOptionalBool(
    data.canPublish ?? data.isPublishable ?? data.eligibleForPublication ?? data.canBePublished,
  );
  if (explicit === true) return true;
  if (explicit === false) return false;

  if (readOptionalBool(data.readyToPublish ?? data.depositsConfirmed ?? data.bothDepositsConfirmed) === true) {
    return true;
  }

  const publication = normalizedFlag(data.publicationStatus);
  return publication === "ready" || publication === "readytopublish" || publication === "pendingpublication";
}

/** Eligibility comes from Mohammed's flags — never from local deposit math. */
export function canPublishBooking(item: Pick<HallBookingNotification, "status" | "canPublish" | "isPublished">): boolean {
  if (item.isPublished) return false;
  if (
    item.status === "FullyBooked" ||
    item.status === "Rejected" ||
    item.status === "Cancelled" ||
    item.status === "Pending" ||
    item.status == null
  ) {
    return false;
  }
  return item.canPublish === true;
}

export function visibleScheduleBookings(
  items: HallBookingNotification[],
  publishingId: string | null,
  keepPublishedIds?: Set<string>,
  deletingId?: string | null,
): HallBookingNotification[] {
  return items.filter((item) => {
    if (publishingId === item.id) return true;
    if (deletingId === item.id) return true;
    if (keepPublishedIds?.has(item.id)) return true;
    return canPublishBooking(item) || item.canDelete === true;
  });
}
