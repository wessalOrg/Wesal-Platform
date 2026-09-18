import api from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import { toAcceptBookingError } from "@/lib/accept-booking-errors";
import { toDeleteBookingError } from "@/lib/delete-booking-errors";
import { toPublishBookingError } from "@/lib/publish-booking-errors";
import { toRejectBookingError } from "@/lib/reject-booking-errors";
import {
  mapAcceptBookingResult,
  mapDeleteBookingResult,
  mapHallBookingNotification,
  mapPublishBookingResult,
  mapRejectBookingResult,
  notificationErrorKind,
  notificationErrorMessageKey,
  unwrapNotificationList,
} from "@/lib/hall-notifications";
import type {
  AcceptBookingResult,
  DeleteBookingResult,
  HallBookingNotification,
  PublishBookingResult,
  RejectBookingResult,
} from "@/types/hall-notifications";

/**
 * wesal-api US-OWNER-09: GET /owner/halls/{hallId}/bookings (pending requests).
 */
export async function fetchHallBookingNotifications(
  hallId: string,
  signal?: AbortSignal,
): Promise<HallBookingNotification[]> {
  const trimmed = hallId.trim();
  if (!trimmed) {
    throw new ApiError("errors.owner.notifications.notFound", 404);
  }

  try {
    const { data } = await api.get<unknown>(`/owner/halls/${trimmed}/bookings`, {
      timeout: 8000,
      signal,
    });
    return unwrapNotificationList(data)
      .map((item, index) => mapHallBookingNotification(item, trimmed, index))
      .filter((item): item is HallBookingNotification => Boolean(item));
  } catch (err) {
    if (err instanceof ApiError) {
      throw new ApiError(notificationErrorMessageKey(notificationErrorKind(err)), err.status);
    }
    throw new ApiError("errors.owner.notifications.load");
  }
}

/**
 * Muhammad Shamaa: owner acceptance. Same hall/booking prefix as reject/cancel.
 */
export async function acceptHallBookingRequest(
  hallId: string,
  bookingId: string,
): Promise<AcceptBookingResult> {
  const hall = hallId.trim();
  const booking = bookingId.trim();
  if (!hall || !booking) {
    throw toAcceptBookingError(new ApiError("errors.owner.accept.notFound", 404));
  }

  try {
    const { data } = await api.post<unknown>(
      `/halls/${hall}/bookings/${booking}/accept`,
      undefined,
      { timeout: 10000 },
    );
    return mapAcceptBookingResult(data, hall, booking);
  } catch (err) {
    throw toAcceptBookingError(err);
  }
}

export async function rejectHallBookingRequest(
  hallId: string,
  bookingId: string,
  reason: string,
): Promise<RejectBookingResult> {
  const hall = hallId.trim();
  const booking = bookingId.trim();
  const trimmedReason = reason.trim();
  if (!hall || !booking) {
    throw toRejectBookingError(new ApiError("errors.owner.reject.notFound", 404));
  }
  if (!trimmedReason) {
    throw toRejectBookingError(new ApiError("errors.owner.reject.required", 400));
  }

  try {
    const { data } = await api.post<unknown>(
      `/halls/${hall}/bookings/${booking}/reject`,
      { reason: trimmedReason },
      { timeout: 10000 },
    );
    return mapRejectBookingResult(data, hall, booking, trimmedReason);
  } catch (err) {
    throw toRejectBookingError(err);
  }
}

/**
 * Muhammad Shamaa: owner publication. Same hall/booking prefix as accept/reject.
 * Never treat a failed response as published on the client.
 */
export async function publishHallBooking(
  hallId: string,
  bookingId: string,
): Promise<PublishBookingResult> {
  const hall = hallId.trim();
  const booking = bookingId.trim();
  if (!hall || !booking) {
    throw toPublishBookingError(new ApiError("errors.owner.publish.notFound", 404));
  }

  try {
    const { data } = await api.post<unknown>(
      `/halls/${hall}/bookings/${booking}/publish`,
      undefined,
      { timeout: 10000 },
    );
    return mapPublishBookingResult(data, hall, booking);
  } catch (err) {
    throw toPublishBookingError(err);
  }
}

/**
 * Muhammad Shamaa: owner deletion. Same hall/booking prefix as accept/reject/publish.
 * Never treat a failed/rejected response as deleted on the client.
 */
export async function deleteHallBooking(
  hallId: string,
  bookingId: string,
): Promise<DeleteBookingResult> {
  const hall = hallId.trim();
  const booking = bookingId.trim();
  if (!hall || !booking) {
    throw toDeleteBookingError(new ApiError("errors.owner.delete.notFound", 404));
  }

  try {
    const { data } = await api.post<unknown>(
      `/halls/${hall}/bookings/${booking}/delete`,
      undefined,
      { timeout: 10000 },
    );
    return mapDeleteBookingResult(data, hall, booking);
  } catch (err) {
    throw toDeleteBookingError(err);
  }
}
