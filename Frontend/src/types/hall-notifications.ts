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
  status: OwnerBookingRequestStatus | null;
  rejectionReason?: string;
  /** Backend flag — do not infer from deposits on the client. */
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
  status: OwnerBookingRequestStatus;
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
