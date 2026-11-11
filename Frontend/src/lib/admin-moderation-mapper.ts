import { resolveOfferMediaUrl } from "@/lib/offer-format";
import type {
  AccountLockStatus,
  AdminActionResult,
  AdminLockedAccount,
  AdminModeratedContent,
  AdminModeratedContentPage,
  AdminModeratedImage,
  AdminModerationContentKind,
  AdminLockedAccountPage,
} from "@/types/admin-moderation";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
  }
  return false;
}

function parseRemainingMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  const text = asText(value);
  if (!text) return 0;
  // TimeSpan may arrive as "7.00:00:00" / "1.12:30:00" / "12:30:00"
  const match = text.match(/^(?:(\d+)\.)?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (!match) return 0;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
}

function mapImage(
  raw: unknown,
  kind: AdminModerationContentKind,
  contentId: string,
): AdminModeratedImage | null {
  const dto = asRecord(raw);
  if (!dto) return null;
  const id = asText(dto.id ?? dto.Id);
  if (!id) return null;
  const urlRaw = asText(dto.url ?? dto.Url);
  const fallback =
    kind === "post"
      ? `/api/v1/admin/moderation/posts/${contentId}/images/${id}`
      : `/api/v1/admin/moderation/offers/${contentId}/images/${id}`;
  return {
    id,
    url: resolveOfferMediaUrl(urlRaw || fallback),
    order: asNumber(dto.order ?? dto.Order) ?? 0,
  };
}

export function mapAdminModeratedContent(
  raw: unknown,
  kind: AdminModerationContentKind,
): AdminModeratedContent | null {
  const dto = asRecord(raw);
  if (!dto) return null;
  const id = asText(dto.id ?? dto.Id);
  if (!id) return null;
  const imagesRaw = dto.images ?? dto.Images;
  const images = Array.isArray(imagesRaw)
    ? imagesRaw
        .map((img) => mapImage(img, kind, id))
        .filter((img): img is AdminModeratedImage => Boolean(img))
        .sort((a, b) => a.order - b.order)
    : [];

  return {
    id,
    kind,
    ownerUserId: asText(dto.ownerUserId ?? dto.OwnerUserId),
    ownerDisplayName: asText(dto.ownerDisplayName ?? dto.OwnerDisplayName),
    ownerRole: asText(dto.ownerRole ?? dto.OwnerRole) || "Unknown",
    ownerIsLocked: asBool(dto.ownerIsLocked ?? dto.OwnerIsLocked),
    content: asText(dto.content ?? dto.Content) || null,
    price: asNumber(dto.price ?? dto.Price),
    oldPrice: asNumber(dto.oldPrice ?? dto.OldPrice),
    offerPrice: asNumber(dto.offerPrice ?? dto.OfferPrice),
    startsAt: asText(dto.startsAt ?? dto.StartsAt) || null,
    endsAt: asText(dto.endsAt ?? dto.EndsAt) || null,
    stoppedAt: asText(dto.stoppedAt ?? dto.StoppedAt) || null,
    status: asText(dto.status ?? dto.Status) || null,
    createdAt: asText(dto.createdAt ?? dto.CreatedAt) || null,
    images,
  };
}

function mapPaged<T>(
  raw: unknown,
  mapItem: (item: unknown) => T | null,
): { items: T[]; pageNumber: number; pageSize: number; totalCount: number; totalPages: number } {
  const dto = asRecord(raw) ?? {};
  const list = dto.items ?? dto.Items;
  const items = Array.isArray(list)
    ? list.map(mapItem).filter((item): item is T => Boolean(item))
    : [];
  const pageNumber = asNumber(dto.pageNumber ?? dto.PageNumber) ?? 1;
  const pageSize = (asNumber(dto.pageSize ?? dto.PageSize) ?? items.length) || 10;
  const totalCount = asNumber(dto.totalCount ?? dto.TotalCount) ?? items.length;
  const totalPages =
    asNumber(dto.totalPages ?? dto.TotalPages) ??
    (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0);
  return { items, pageNumber, pageSize, totalCount, totalPages };
}

export function mapAdminModeratedContentPage(
  raw: unknown,
  kind: AdminModerationContentKind,
): AdminModeratedContentPage {
  return mapPaged(raw, (item) => mapAdminModeratedContent(item, kind));
}

export function mapAccountLockStatus(raw: unknown): AccountLockStatus {
  const dto = asRecord(raw) ?? {};
  return {
    isLocked: asBool(dto.isLocked ?? dto.IsLocked),
    lockedUntil: asText(dto.lockedUntil ?? dto.LockedUntil) || null,
    reason: asText(dto.reason ?? dto.Reason) || null,
  };
}

export function mapAdminLockedAccount(raw: unknown): AdminLockedAccount | null {
  const dto = asRecord(raw);
  if (!dto) return null;
  const userId = asText(dto.userId ?? dto.UserId);
  if (!userId) return null;
  return {
    userId,
    displayName: asText(dto.displayName ?? dto.DisplayName),
    businessName: asText(dto.businessName ?? dto.BusinessName) || null,
    role: asText(dto.role ?? dto.Role),
    lockedAt: asText(dto.lockedAt ?? dto.LockedAt),
    lockedUntil: asText(dto.lockedUntil ?? dto.LockedUntil),
    remainingMs: parseRemainingMs(dto.remaining ?? dto.Remaining),
    reason: asText(dto.reason ?? dto.Reason) || null,
    lockingAdminId: asText(dto.lockingAdminId ?? dto.LockingAdminId),
    photographerAdminOnlyFullName:
      asText(dto.photographerAdminOnlyFullName ?? dto.PhotographerAdminOnlyFullName) || null,
    unlockAction: asText(dto.unlockAction ?? dto.UnlockAction),
  };
}

export function mapAdminLockedAccountPage(raw: unknown): AdminLockedAccountPage {
  return mapPaged(raw, mapAdminLockedAccount);
}

export function mapAdminActionResult(raw: unknown): AdminActionResult {
  const dto = asRecord(raw) ?? {};
  const removedRaw = asRecord(dto.removedItems ?? dto.RemovedItems) ?? {};
  const removedItems: Record<string, number> = {};
  for (const [key, value] of Object.entries(removedRaw)) {
    const n = asNumber(value);
    if (n != null) removedItems[key] = n;
  }
  return {
    success: asBool(dto.success ?? dto.Success ?? true),
    removedCount: asNumber(dto.removedCount ?? dto.RemovedCount) ?? 0,
    removedItems,
  };
}

/** Human period label for success copy (hours → days when divisible). */
export function formatLockPeriodHours(
  hours: number,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (hours === 24) return t("admin.moderation.period.24h");
  if (hours === 72) return t("admin.moderation.period.3d");
  if (hours === 168) return t("admin.moderation.period.7d");
  if (hours === 720) return t("admin.moderation.period.30d");
  if (hours % 24 === 0) {
    const days = hours / 24;
    return t("admin.moderation.period.days", { count: days });
  }
  return t("admin.moderation.period.hours", { count: hours });
}
