import { isOfferPubliclyVisible } from "@/lib/offer-status";
import type { DiscoverFilter, DiscoverItem } from "@/types/offers";

export const DISCOVER_FILTERS: DiscoverFilter[] = [
  "All",
  "Halls",
  "EventCoordinators",
  "Photographers",
  "Offers",
];

export function normalizeDiscoverFilter(value: string | null | undefined): DiscoverFilter {
  const raw = (value ?? "All").trim();
  if (raw === "Coordinators" || raw === "Event Coordinators") {
    return "EventCoordinators";
  }
  if (
    raw === "All" ||
    raw === "Halls" ||
    raw === "EventCoordinators" ||
    raw === "Photographers" ||
    raw === "Offers"
  ) {
    return raw;
  }
  return "All";
}

/** Section 19 — placeholder keyed to the active filter. */
export function discoverSearchPlaceholderKey(filter: DiscoverFilter): string {
  switch (filter) {
    case "Halls":
      return "discover.search.placeholder.halls";
    case "EventCoordinators":
    case "Coordinators":
      return "discover.search.placeholder.coordinators";
    case "Photographers":
      return "discover.search.placeholder.photographers";
    case "Offers":
      return "discover.search.placeholder.offers";
    default:
      return "discover.search.placeholder.all";
  }
}

/** Drop expired/stopped offer rows that may still arrive from the API. */
export function filterVisibleDiscoverItems(items: DiscoverItem[]): DiscoverItem[] {
  return items.filter((item) => {
    if (
      item.contentType !== "ProfessionalOffer" &&
      item.contentType !== "HallOffer"
    ) {
      return true;
    }
    return isOfferPubliclyVisible(item.startsAt, item.endsAt, item.stoppedAt);
  });
}

export function discoverItemHref(item: {
  contentType: string;
  id: string;
  ownerUserId: string | null;
  hallId?: string | null;
}): string | null {
  if (item.contentType === "Post") {
    return `/posts/${encodeURIComponent(item.id)}`;
  }
  if (
    (item.contentType === "EventCoordinator" ||
      item.contentType === "Photographer") &&
    item.ownerUserId
  ) {
    return `/professionals/${encodeURIComponent(item.ownerUserId)}`;
  }
  if (item.contentType === "Hall") {
    return `/halls/${encodeURIComponent(item.hallId || item.id)}`;
  }
  if (item.contentType === "ProfessionalOffer" && item.ownerUserId) {
    return `/professionals/${encodeURIComponent(item.ownerUserId)}`;
  }
  if (item.contentType === "HallOffer" && item.hallId) {
    return `/halls/${encodeURIComponent(item.hallId)}`;
  }
  if (item.contentType === "HallOffer") {
    return `/discover?filter=Offers&offer=${encodeURIComponent(item.id)}`;
  }
  return null;
}
