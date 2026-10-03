import type { BookingPeriodType } from "@/types/booking";

export const BOOKING_CANCELLED_EVENT = "wesal-booking-cancelled";
export const BOOKING_ACCEPTED_EVENT = "wesal-booking-accepted";
export const BOOKING_REJECTED_EVENT = "wesal-booking-rejected";
export const BOOKING_PUBLISHED_EVENT = "wesal-booking-published";
export const BOOKING_DELETED_EVENT = "wesal-booking-deleted";
export const BOOKING_SUBMITTED_EVENT = "wesal-booking-submitted";
export const OWNER_BOOKING_REJECTION_EVENT = "wesal:booking-rejection-notification";

export type BookingCancelledDetail = {
  bookingId: string;
  hallId: string;
  date: string;
  period: string;
  hallName?: string;
  requesterName?: string;
};

export type BookingAcceptedDetail = {
  bookingId: string;
  hallId: string;
  date: string;
  periods?: BookingPeriodType[];
  hallName?: string;
  depositAmount?: number | null;
  /**
   * The seeker <-> hall owner thread the approval landed in. The backend resolves exactly
   * this conversation when it accepts a booking, so carrying it here lets the "deposit
   * required" notification open the right thread instead of falling back to the bookings
   * list. Optional because an acceptance surfaced outside a thread (e.g. the owner-side
   * accept action) has no seeker-facing conversation to open.
   */
  conversationId?: string;
};

export type BookingRejectedDetail = {
  bookingId: string;
  hallId: string;
  date: string;
  periods?: BookingPeriodType[];
  deferred?: boolean;
  rejectionReason?: string;
  hallName?: string;
};

export type BookingSubmittedDetail = {
  hallId: string;
  hallName: string;
  date: string;
  bookingId?: string;
  periods?: BookingPeriodType[];
  timeRange?: string;
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

export function emitBookingSubmitted(detail: BookingSubmittedDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BOOKING_SUBMITTED_EVENT, { detail }));
}
