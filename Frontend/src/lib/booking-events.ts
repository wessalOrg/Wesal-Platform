import type { BookingPeriodType } from "@/types/booking";

export const BOOKING_CANCELLED_EVENT = "wesal-booking-cancelled";
export const BOOKING_ACCEPTED_EVENT = "wesal-booking-accepted";
export const BOOKING_REJECTED_EVENT = "wesal-booking-rejected";
export const BOOKING_PUBLISHED_EVENT = "wesal-booking-published";
export const BOOKING_DELETED_EVENT = "wesal-booking-deleted";
export const OWNER_BOOKING_REJECTION_EVENT = "wesal:booking-rejection-notification";

export type BookingCancelledDetail = {
  bookingId: string;
  hallId: string;
  date: string;
  period: string;
};

export type BookingAcceptedDetail = {
  bookingId: string;
  hallId: string;
  date: string;
  periods?: BookingPeriodType[];
};

export type BookingRejectedDetail = {
  bookingId: string;
  hallId: string;
  date: string;
  periods?: BookingPeriodType[];
  deferred?: boolean;
};

export type BookingPublishedDetail = {
  bookingId: string;
  hallId: string;
  date: string;
  periods?: BookingPeriodType[];
};

export type BookingDeletedDetail = {
  bookingId: string;
  hallId: string;
  date: string;
  periods?: BookingPeriodType[];
};

export function emitBookingCancelled(detail: BookingCancelledDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BOOKING_CANCELLED_EVENT, { detail }));
}

export function emitBookingAccepted(detail: BookingAcceptedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BOOKING_ACCEPTED_EVENT, { detail }));
}

export function emitBookingRejected(detail: BookingRejectedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BOOKING_REJECTED_EVENT, { detail }));
  window.dispatchEvent(new CustomEvent(OWNER_BOOKING_REJECTION_EVENT, { detail }));
}

export function emitBookingPublished(detail: BookingPublishedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BOOKING_PUBLISHED_EVENT, { detail }));
}

export function emitBookingDeleted(detail: BookingDeletedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BOOKING_DELETED_EVENT, { detail }));
}
