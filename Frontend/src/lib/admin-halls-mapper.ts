import { parseDateIso, utcDaysRemaining, utcTodayIso } from "@/lib/booking-date";
import { mapBackendHallStatus } from "@/lib/hall-owner-halls-mapper";
import { resolveMediaUrl } from "@/lib/hall-media-url";
import type {
  AdminHallApprovalResult,
  AdminHallDetail,
  AdminHallLockAccess,
  AdminHallLockResult,
  AdminHallRejectResult,
  AdminHallStatus,
  AdminHallUnlockResult,
  AdminMarkPaidResult,
  AdminOwnerMessageResult,
  AdminPaymentStatus,
  AdminPendingHall,
  AdminSubscriptionHall,
  AdminSubscriptionOwnerGroup,
} from "@/types/admin-halls";

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asId(value: unknown): string | null {
  const text = asText(value);
  return text || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    return text === "true" || text === "1";
  }
  return false;
}

function mapStatus(raw: unknown): AdminHallStatus | null {
  const text = asText(raw);
  const badge = mapBackendHallStatus(text);
  if (badge === "Pending") return "PendingReview";
  if (badge === "Approved") return "Approved";
  if (badge === "Rejected") return "Rejected";
  return null;
}

function asInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function mapPaymentStatus(raw: unknown): AdminPaymentStatus {
  const token = asText(raw).replace(/[\s_-]/g, "").toLowerCase();
  if (token === "paid" || token === "1") return "Paid";
  if (token === "receiptuploaded" || token === "2") return "ReceiptUploaded";
  return "Unpaid";
}

function readCycleDate(dto: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const iso = parseDateIso(asText(dto[key]));
    if (iso) return iso;
  }
  return null;
}

export function mapAdminHallDetail(payload: unknown): AdminHallDetail | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const hallId = asId(dto.hallId ?? dto.HallId ?? dto.id ?? dto.Id);
  const status = mapStatus(dto.status ?? dto.Status);
  if (!hallId || !status) return null;

  const mainImageUrl =
    resolveMediaUrl(
      asText(dto.mainImageUrl ?? dto.MainImageUrl ?? dto.mainImage ?? dto.MainImage),
    ) || null;

  const photosRaw = dto.photoUrls ?? dto.PhotoUrls ?? dto.images ?? dto.Images;
  const galleryUrls = Array.isArray(photosRaw)
    ? photosRaw
        .map((item) => resolveMediaUrl(asText(item)))
        .filter(Boolean)
    : [];

  // Cover lives on MainImageUrl and is often NOT duplicated in PhotoUrls.
  const photoUrls = mergeUniqueMediaUrls(
    mainImageUrl ? [mainImageUrl] : [],
    galleryUrls,
  );

  const featuresRaw = dto.features ?? dto.Features;
  const features = Array.isArray(featuresRaw)
    ? featuresRaw.map((item) => asText(item)).filter(Boolean)
    : [];

  const badge = mapBackendHallStatus(status) ?? "Pending";
  const cycleEnd = readCycleDate(dto, [
    "subscriptionCycleEnd",
    "SubscriptionCycleEnd",
    "cycleEnd",
    "CycleEnd",
    "nextBillingDate",
    "NextBillingDate",
  ]);

  return {
    hallId,
    name: asText(dto.name ?? dto.Name) || "—",
    regionDisplayName: asText(dto.regionDisplayName ?? dto.RegionDisplayName),
    address: asText(dto.address ?? dto.Address),
    detailedAddress: asText(dto.detailedAddress ?? dto.DetailedAddress) || null,
    description: asText(dto.description ?? dto.Description) || null,
    capacity: asNumber(dto.capacity ?? dto.Capacity) ?? 0,
    price: asNumber(dto.price ?? dto.Price),
    submittedAt: asText(dto.submittedAt ?? dto.SubmittedAt) || null,
    status,
    approvalBadge: badge,
    ownerId: asId(dto.ownerId ?? dto.OwnerId),
    ownerFullName: asText(dto.ownerFullName ?? dto.OwnerFullName) || null,
    ownerPhoneNumber: asText(dto.ownerPhoneNumber ?? dto.OwnerPhoneNumber) || null,
    ownerEmail: asText(dto.ownerEmail ?? dto.OwnerEmail) || null,
    mainImageUrl: mainImageUrl || photoUrls[0] || null,
    photoUrls,
    youtubeVideoUrl: asText(dto.youtubeVideoUrl ?? dto.YouTubeVideoUrl) || null,
    features,
    otherFeatures: asText(dto.otherFeatures ?? dto.OtherFeatures) || null,
    adminLocked: asBool(dto.adminLocked ?? dto.AdminLocked ?? dto.isLocked ?? dto.IsLocked),
    systemLocked: asBool(dto.systemLocked ?? dto.SystemLocked),
    paymentStatus: mapPaymentStatus(dto.paymentStatus ?? dto.PaymentStatus),
    paymentReceiptUploadedAt:
      asText(dto.paymentReceiptUploadedAt ?? dto.PaymentReceiptUploadedAt) || null,
    hasPaymentReceipt: asBool(dto.hasPaymentReceipt ?? dto.HasPaymentReceipt),
    ownerHasIdentityDocument: asBool(
      dto.ownerHasIdentityDocument ?? dto.OwnerHasIdentityDocument,
    ),
    cycleStart: readCycleDate(dto, [
      "subscriptionCycleStart",
      "SubscriptionCycleStart",
      "cycleStart",
      "CycleStart",
    ]),
    cycleEnd,
    daysRemaining:
      asInt(dto.daysRemaining ?? dto.DaysRemaining) ?? (cycleEnd ? utcDaysRemaining(cycleEnd) : null),
  };
}

function mergeUniqueMediaUrls(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of groups) {
    for (const url of group) {
      const key = url.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(key);
    }
  }
  return result;
}

export function mapAdminPendingHalls(payload: unknown): AdminPendingHall[] {
  const root =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(root?.items)
      ? root.items
      : Array.isArray(root?.Items)
        ? root.Items
        : [];

  const halls: AdminPendingHall[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const dto = item as Record<string, unknown>;
    const hallId = asId(dto.hallId ?? dto.HallId ?? dto.id ?? dto.Id);
    if (!hallId) continue;
    halls.push({
      hallId,
      name: asText(dto.name ?? dto.Name) || "—",
      thumbnailUrl:
        resolveMediaUrl(asText(dto.thumbnailUrl ?? dto.ThumbnailUrl ?? dto.mainImageUrl ?? dto.MainImageUrl)) ||
        null,
      submittedAt: asText(dto.submittedAt ?? dto.SubmittedAt) || null,
      adminLocked: asBool(dto.adminLocked ?? dto.AdminLocked ?? dto.isLocked ?? dto.IsLocked),
      systemLocked: asBool(dto.systemLocked ?? dto.SystemLocked),
    });
  }
  return halls;
}

export function mapAdminHallApproval(payload: unknown): AdminHallApprovalResult | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const hallId = asId(dto.hallId ?? dto.HallId);
  const status = mapStatus(dto.status ?? dto.Status) ?? "Approved";
  if (!hallId) return null;
  return {
    hallId,
    hallName: asText(dto.hallName ?? dto.HallName),
    status,
    isApproved: Boolean(dto.isApproved ?? dto.IsApproved) || status === "Approved",
    approvedAt: asText(dto.approvedAt ?? dto.ApprovedAt) || null,
  };
}

export function canApproveHallStatus(status: AdminHallStatus): boolean {
  return status === "PendingReview";
}

/** PendingReview or live Approved (needs confirmLiveApproved). */
export function canRejectHallStatus(status: AdminHallStatus): boolean {
  return status === "PendingReview" || status === "Approved";
}

export function resolveAdminHallLockAccess(
  adminLocked: boolean,
  systemLocked: boolean,
): AdminHallLockAccess {
  if (adminLocked) return "adminLocked";
  if (systemLocked) return "unpaidLocked";
  return "unlocked";
}

export function canLockAdminHall(adminLocked: boolean): boolean {
  return !adminLocked;
}

export function canUnlockAdminHall(adminLocked: boolean): boolean {
  return adminLocked;
}

export function mapAdminHallReject(payload: unknown): AdminHallRejectResult | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const hallId = asId(dto.hallId ?? dto.HallId);
  const status = mapStatus(dto.status ?? dto.Status);
  if (!hallId || !status) return null;

  return {
    hallId,
    hallName: asText(dto.name ?? dto.Name ?? dto.hallName ?? dto.HallName),
    status,
    isAlreadyRejected: asBool(dto.isAlreadyRejected ?? dto.IsAlreadyRejected) || status === "Rejected",
    notificationDelivered: asBool(dto.notificationDelivered ?? dto.NotificationDelivered),
  };
}

export function mapAdminHallLock(payload: unknown): AdminHallLockResult | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const hallId = asId(dto.hallId ?? dto.HallId);
  if (!hallId) return null;

  return {
    hallId,
    hallName: asText(dto.name ?? dto.Name ?? dto.hallName ?? dto.HallName),
    adminLocked: asBool(dto.isLocked ?? dto.IsLocked ?? dto.adminLocked ?? dto.AdminLocked),
    lockedAt: asText(dto.lockedAt ?? dto.LockedAt) || null,
    lockedByAdminUserId: asText(dto.lockedByAdminUserId ?? dto.LockedByAdminUserId) || null,
  };
}

export function canMarkHallPaid(
  status: AdminHallStatus,
  paymentStatus: AdminPaymentStatus,
  systemLocked: boolean,
  cycleEnd: string | null,
  todayIso = utcTodayIso(),
): boolean {
  if (status !== "Approved") return false;
  if (systemLocked) return true;
  if (paymentStatus !== "Paid") return true;
  if (!cycleEnd) return true;
  const remaining = utcDaysRemaining(cycleEnd, todayIso);
  return remaining != null && remaining < 0;
}

export function mapAdminMarkPaid(payload: unknown): AdminMarkPaidResult | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const hallId = asId(dto.hallId ?? dto.HallId);
  if (!hallId) return null;

  const cycleEnd = readCycleDate(dto, ["cycleEnd", "CycleEnd", "subscriptionCycleEnd", "SubscriptionCycleEnd"]);
  const remaining =
    asInt(dto.daysRemaining ?? dto.DaysRemaining) ?? (cycleEnd ? utcDaysRemaining(cycleEnd) : null);

  return {
    hallId,
    hallName: asText(dto.name ?? dto.Name ?? dto.hallName ?? dto.HallName),
    status: mapStatus(dto.status ?? dto.Status) ?? "Approved",
    paymentStatus: mapPaymentStatus(dto.paymentStatus ?? dto.PaymentStatus) || "Paid",
    systemLocked: asBool(dto.systemLocked ?? dto.SystemLocked),
    adminLocked: asBool(dto.adminLocked ?? dto.AdminLocked ?? dto.isLocked ?? dto.IsLocked),
    cycleStart: readCycleDate(dto, ["cycleStart", "CycleStart", "subscriptionCycleStart", "SubscriptionCycleStart"]),
    cycleEnd,
    daysRemaining: remaining,
    amountIls: asNumber(dto.amountIls ?? dto.AmountIls),
    alreadyPaidWithActiveCycle: asBool(
      dto.alreadyPaidWithActiveCycle ?? dto.AlreadyPaidWithActiveCycle,
    ),
  };
}

function mapSubscriptionHall(dto: Record<string, unknown>): AdminSubscriptionHall | null {
  const hallId = asId(dto.hallId ?? dto.HallId ?? dto.id ?? dto.Id);
  const approvalStatus = mapStatus(dto.approvalStatus ?? dto.ApprovalStatus ?? dto.status ?? dto.Status);
  if (!hallId || !approvalStatus) return null;
  const nextBillingDate = readCycleDate(dto, [
    "nextBillingDate",
    "NextBillingDate",
    "cycleEnd",
    "CycleEnd",
    "subscriptionCycleEnd",
    "SubscriptionCycleEnd",
  ]);
  return {
    hallId,
    name: asText(dto.name ?? dto.Name) || "—",
    approvalStatus,
    paymentStatus: mapPaymentStatus(dto.paymentStatus ?? dto.PaymentStatus),
    systemLocked: asBool(dto.systemLocked ?? dto.SystemLocked),
    adminLocked: asBool(dto.adminLocked ?? dto.AdminLocked),
    nextBillingDate,
    daysRemaining:
      asInt(dto.daysRemaining ?? dto.DaysRemaining) ??
      (nextBillingDate ? utcDaysRemaining(nextBillingDate) : null),
    lastPaymentDate: readCycleDate(dto, [
      "lastPaymentDate",
      "LastPaymentDate",
      "cycleStart",
      "CycleStart",
      "subscriptionCycleStart",
      "SubscriptionCycleStart",
    ]),
  };
}

export function mapAdminSubscriptionOverview(payload: unknown): AdminSubscriptionOwnerGroup[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { items?: unknown }).items)
      ? ((payload as { items: unknown[] }).items)
      : [];

  const groups: AdminSubscriptionOwnerGroup[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const dto = item as Record<string, unknown>;
    const ownerId = asId(dto.ownerId ?? dto.OwnerId) ?? "";
    const hallsRaw = dto.halls ?? dto.Halls;
    const halls: AdminSubscriptionHall[] = [];
    if (Array.isArray(hallsRaw)) {
      for (const hall of hallsRaw) {
        if (!hall || typeof hall !== "object") continue;
        const mapped = mapSubscriptionHall(hall as Record<string, unknown>);
        if (mapped) halls.push(mapped);
      }
    }
    groups.push({
      ownerId,
      ownerFullName: asText(dto.ownerFullName ?? dto.OwnerFullName) || null,
      ownerPhoneNumber: asText(dto.ownerPhoneNumber ?? dto.OwnerPhoneNumber) || null,
      ownerEmail: asText(dto.ownerEmail ?? dto.OwnerEmail) || null,
      halls,
    });
  }
  return groups;
}

export function mapAdminHallUnlock(payload: unknown): AdminHallUnlockResult | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const hallId = asId(dto.hallId ?? dto.HallId);
  if (!hallId) return null;

  const adminLocked = asBool(dto.adminLocked ?? dto.AdminLocked ?? dto.isLocked ?? dto.IsLocked);
  const systemLocked = asBool(dto.systemLocked ?? dto.SystemLocked);

  return {
    hallId,
    hallName: asText(dto.name ?? dto.Name ?? dto.hallName ?? dto.HallName),
    adminLocked,
    systemLocked,
    managementAccessRestored:
      asBool(dto.managementAccessRestored ?? dto.ManagementAccessRestored) ||
      (!adminLocked && !systemLocked),
    unlockedAt: asText(dto.unlockedAt ?? dto.UnlockedAt) || null,
  };
}

export function mapAdminOwnerMessage(payload: unknown): AdminOwnerMessageResult | null {
  if (!payload || typeof payload !== "object") return null;
  const dto = payload as Record<string, unknown>;
  const messageId = asId(dto.messageId ?? dto.MessageId ?? dto.id ?? dto.Id);
  const conversationId = asId(dto.conversationId ?? dto.ConversationId);
  const hallId = asId(dto.hallId ?? dto.HallId);
  const content = asText(dto.content ?? dto.Content);
  if (!messageId || !conversationId || !hallId || !content) return null;

  const ownerBlocked = asBool(dto.ownerBlocked ?? dto.OwnerBlocked);
  const deliveryPending =
    asBool(dto.deliveryPending ?? dto.DeliveryPending) || ownerBlocked;

  return {
    messageId,
    conversationId,
    hallId,
    content,
    sentAt: asText(dto.sentAt ?? dto.SentAt) || new Date().toISOString(),
    ownerBlocked,
    deliveryPending,
  };
}
