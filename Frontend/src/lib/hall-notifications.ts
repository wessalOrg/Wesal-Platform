import { ApiError } from "@/lib/api-error";
import { parseDateIso } from "@/lib/booking-date";
import { parseBookingPeriodType } from "@/lib/booking-period";
import { parseCanPublishFlag, parsePublishedFlag } from "@/lib/owner-publish-booking";
import { parseCanDeleteFlag } from "@/lib/owner-delete-booking";
import {
  parseOwnerBookingRequestStatus,
  statusAfterOwnerAccept,
  statusAfterOwnerPublish,
} from "@/lib/owner-booking-status";
import type { BookingPeriodType } from "@/types/booking";
import type {
  AcceptBookingResult,
  HallBookingNotification,
  HallNotificationsErrorKind,
  PublishBookingResult,
  DeleteBookingResult,
  RejectBookingResult,
} from "@/types/hall-notifications";

type NotificationDto = {
  bookingId?: string;
  bookingRequestId?: string;
  id?: string;
  hallId?: string;
  requesterName?: string;
  requesterFullName?: string;
  requesterUserName?: string;
  fullName?: string;
  name?: string;
  requesterUserId?: string;
  userId?: string;
  date?: string;
  requestedDate?: string;
  requestedPeriod?: number | string;
  period?: number | string;
  periods?: unknown;
  status?: string | number;
  rejectionReason?: string;
  reason?: string;
  canPublish?: unknown;
  isPublishable?: unknown;
  eligibleForPublication?: unknown;
  canBePublished?: unknown;
  readyToPublish?: unknown;
  depositsConfirmed?: unknown;
  bothDepositsConfirmed?: unknown;
  isPublished?: unknown;
  published?: unknown;
  publicationStatus?: unknown;
  canDelete?: unknown;
  isDeletable?: unknown;
  eligibleForDeletion?: unknown;
  canBeDeleted?: unknown;
  allowDelete?: unknown;
};

export function notificationErrorKind(err: unknown): HallNotificationsErrorKind {
  const status = err instanceof ApiError ? err.status : undefined;
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  return "generic";
}

export function notificationErrorMessageKey(kind: HallNotificationsErrorKind): string {
  if (kind === "unauthorized") return "errors.owner.notifications.unauthorized";
  if (kind === "forbidden") return "errors.owner.notifications.forbidden";
  if (kind === "not_found") return "errors.owner.notifications.notFound";
  return "errors.owner.notifications.load";
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function periodsFromDto(data: NotificationDto): BookingPeriodType[] {
  const collected: BookingPeriodType[] = [];

  if (Array.isArray(data.periods)) {
    for (const item of data.periods) {
      if (typeof item === "string" || typeof item === "number") {
        const parsed = parseBookingPeriodType(item);
        if (parsed) collected.push(parsed);
        continue;
      }
      if (item && typeof item === "object") {
        const raw = item as { period?: unknown; periodType?: unknown };
        const parsed = parseBookingPeriodType(
          (raw.period ?? raw.periodType) as string | number | undefined,
        );
        if (parsed) collected.push(parsed);
      }
    }
  }

  const single = parseBookingPeriodType(data.requestedPeriod ?? data.period);
  if (single && !collected.includes(single)) collected.push(single);

  return collected;
}

export function mapHallBookingNotification(
  data: NotificationDto,
  fallbackHallId: string,
  index: number,
): HallBookingNotification | null {
  const id =
    asText(data.bookingId || data.bookingRequestId || data.id) ||
    `notification-${fallbackHallId}-${index}`;
  const date = parseDateIso(data.date ?? data.requestedDate);
  const requesterName =
    asText(data.requesterName) ||
    asText(data.requesterFullName) ||
    asText(data.requesterUserName) ||
    asText(data.fullName) ||
    asText(data.name);

  const status = data.status == null ? null : parseOwnerBookingRequestStatus(data.status);
  const isPublished = parsePublishedFlag(data) || status === "FullyBooked";
  const canPublish = !isPublished && parseCanPublishFlag(data);

  return {
    id,
    hallId: asText(data.hallId) || fallbackHallId,
    requesterName,
    requesterUserId: asText(data.requesterUserId || data.userId),
    date: date ?? asText(data.date ?? data.requestedDate),
    periods: periodsFromDto(data),
    status,
    rejectionReason: asText(data.rejectionReason || data.reason) || undefined,
    canPublish,
    isPublished,
    canDelete: parseCanDeleteFlag(data),
  };
}

function unwrapAcceptPayload(payload: unknown): NotificationDto {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  const nested = record.data ?? record.result ?? record.booking;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested as NotificationDto;
  }
  return payload as NotificationDto;
}

export function mapAcceptBookingResult(
  payload: unknown,
  hallId: string,
  bookingId: string,
): AcceptBookingResult {
  const data = unwrapAcceptPayload(payload);
  const mapped = mapHallBookingNotification(data, hallId, 0);
  return {
    bookingId: asText(data.bookingId || data.bookingRequestId || data.id) || bookingId,
    hallId: mapped?.hallId || hallId,
    date: mapped?.date ?? "",
    periods: mapped?.periods ?? [],
    status: statusAfterOwnerAccept(data.status),
  };
}

export function mapPublishBookingResult(
  payload: unknown,
  hallId: string,
  bookingId: string,
): PublishBookingResult {
  const data = unwrapAcceptPayload(payload) as NotificationDto & {
    alreadyPublished?: unknown;
    isAlreadyPublished?: unknown;
  };
  const mapped = mapHallBookingNotification(data, hallId, 0);
  const period = parseBookingPeriodType(data.period);
  const periods =
    mapped?.periods && mapped.periods.length > 0
      ? mapped.periods
      : period
        ? [period]
        : [];

  return {
    bookingId: asText(data.bookingId || data.bookingRequestId || data.id) || bookingId,
    hallId: mapped?.hallId || hallId,
    date: mapped?.date ?? "",
    periods,
    status: statusAfterOwnerPublish(),
    alreadyPublished: Boolean(data.isAlreadyPublished || data.alreadyPublished || mapped?.isPublished),
  };
}

export function mapDeleteBookingResult(
  payload: unknown,
  hallId: string,
  bookingId: string,
): DeleteBookingResult {
  const data = unwrapAcceptPayload(payload) as NotificationDto & {
    alreadyDeleted?: unknown;
    isAlreadyDeleted?: unknown;
    deleted?: unknown;
  };
  const mapped = mapHallBookingNotification(data, hallId, 0);
  const period = parseBookingPeriodType(data.period);
  const periods =
    mapped?.periods && mapped.periods.length > 0
      ? mapped.periods
      : period
        ? [period]
        : [];

  return {
    bookingId: asText(data.bookingId || data.bookingRequestId || data.id) || bookingId,
    hallId: mapped?.hallId || hallId,
    date: mapped?.date ?? "",
    periods,
    alreadyDeleted: Boolean(data.alreadyDeleted || data.isAlreadyDeleted || data.deleted),
  };
}

export function mapRejectBookingResult(
  payload: unknown,
  hallId: string,
  bookingId: string,
  fallbackReason: string,
): RejectBookingResult {
  const data = unwrapAcceptPayload(payload) as NotificationDto & {
    period?: number | string;
    rejectionReason?: string;
    reason?: string;
    isAlreadyRejected?: boolean;
    alreadyRejected?: boolean;
    notificationStatus?: number | string;
  };
  const mapped = mapHallBookingNotification(data, hallId, 0);
  const period = parseBookingPeriodType(data.requestedPeriod ?? data.period);
  const periods =
    mapped?.periods && mapped.periods.length > 0
      ? mapped.periods
      : period
        ? [period]
        : [];
  const notificationStatus = String(data.notificationStatus ?? "").toLowerCase();

  return {
    bookingId: asText(data.bookingId || data.bookingRequestId || data.id) || bookingId,
    hallId: mapped?.hallId || hallId,
    date: mapped?.date ?? "",
    periods,
    status: "Rejected",
    rejectionReason: asText(data.rejectionReason || data.reason) || fallbackReason,
    alreadyRejected: Boolean(data.isAlreadyRejected || data.alreadyRejected),
    notificationDeferred:
      notificationStatus === "deferred" || notificationStatus === "1",
  };
}

export function unwrapNotificationList(payload: unknown): NotificationDto[] {
  if (Array.isArray(payload)) return payload as NotificationDto[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  const nested =
    record.items ??
    record.requests ??
    record.bookings ??
    record.data ??
    record.notifications;

  if (Array.isArray(nested)) return nested as NotificationDto[];
  if (nested && typeof nested === "object") {
    const inner = nested as Record<string, unknown>;
    const list = inner.items ?? inner.requests ?? inner.bookings;
    if (Array.isArray(list)) return list as NotificationDto[];
  }
  return [];
}
