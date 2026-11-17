import type { HallOffer, HallOfferPage } from "@/types/hall-offers";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asId(value: unknown): string | null {
  const text = asText(value);
  return text || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function asInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return 0;
}

export function mapHallOffer(payload: unknown): HallOffer | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const id = asId(dto.id ?? dto.Id);
  const hallId = asId(dto.hallId ?? dto.HallId);
  const oldBookingPrice = asNumber(dto.oldBookingPrice ?? dto.OldBookingPrice);
  const offerPrice = asNumber(dto.offerPrice ?? dto.OfferPrice);
  const startsAt = asText(dto.startsAt ?? dto.StartsAt);
  const endsAt = asText(dto.endsAt ?? dto.EndsAt);
  if (!id || !hallId || oldBookingPrice == null || offerPrice == null || !startsAt || !endsAt) {
    return null;
  }
  return {
    id,
    hallId,
    hallName: asText(dto.hallName ?? dto.HallName),
    mainImageUrl: asText(dto.mainImageUrl ?? dto.MainImageUrl) || null,
    oldBookingPrice,
    offerPrice,
    startsAt,
    endsAt,
    stoppedAt: asText(dto.stoppedAt ?? dto.StoppedAt) || null,
  };
}

export function mapHallOfferPage(payload: unknown): HallOfferPage {
  if (!payload || typeof payload !== "object") {
    return { items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 };
  }
  const dto = payload as Record<string, unknown>;
  const rawItems = dto.items ?? dto.Items;
  const items = Array.isArray(rawItems)
    ? rawItems.map(mapHallOffer).filter((row): row is HallOffer => Boolean(row))
    : [];
  const page = Math.max(1, asInt(dto.pageNumber ?? dto.PageNumber ?? dto.page ?? 1));
  const pageSize = Math.max(1, asInt(dto.pageSize ?? dto.PageSize ?? 10));
  const totalCount = Math.max(0, asInt(dto.totalCount ?? dto.TotalCount ?? items.length));
  const totalPages = Math.max(
    0,
    asInt(dto.totalPages ?? dto.TotalPages) ||
      (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0),
  );
  return { items, page, pageSize, totalCount, totalPages };
}
