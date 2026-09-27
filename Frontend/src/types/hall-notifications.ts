import type { BookingPeriodType } from "@/types/booking";

export type HallNotificationStatus =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "unauthorized"
  | "forbidden"
  | "not_found";

/** Owner-facing request lifecycle. Accepted is deposit-pending, not fully booked. */
export type OwnerBookingRequestStatus =
  | "Pending"
  | "AcceptedPendingDeposit"
  | "FullyBooked"
  | "Rejected"
  | "Cancelled";

export type HallBookingNotification = {
  id: string;
  hallId: string;
  requesterName: string;
  requesterUserId: string;
  date: string;
  periods: BookingPeriodType[];
  slotStarts?: string[];
  timeRange?: string;
  status: OwnerBookingRequestStatus | null;
  rejectionReason?: string;
  depositAmount?: number | null;
  depositPaymentConfirmedAt?: string | null;
  /** True while accepted and the deposit is still outstanding. */
  canPublish: boolean;
  isPublished: boolean;
  /** Backend flag — do not infer deletion eligibility on the client. */
  canDelete: boolean;
};

export type RejectBookingResult = {
  bookingId: string;
  hallId: string;
  date: string;
  periods: BookingPeriodType[];
  status: "Rejected";
  rejectionReason: string;
  alreadyRejected: boolean;
  notificationDeferred: boolean;
};

export type HallNotificationsErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "generic";

export type AcceptBookingResult = {
  bookingId: string;
  hallId: string;
  date: string;
  periods: BookingPeriodType[];
  slotStarts?: string[];
  timeRange?: string;
  status: OwnerBookingRequestStatus;
  depositAmount?: number | null;
};

export type PublishBookingResult = {
  bookingId: string;
  hallId: string;
  date: string;
  periods: BookingPeriodType[];
  status: "FullyBooked";
  alreadyPublished: boolean;
};

export type DeleteBookingResult = {
  bookingId: string;
  hallId: string;
  date: string;
  periods: BookingPeriodType[];
  alreadyDeleted: boolean;
};
