import type { BookingPeriodType, BookingStatus } from "@/types/booking";

/** Hall-scoped incoming booking request for owner notifications (US-OWNER-09). */
export type OwnerHallBookingRequest = {
  id: string;
  hallId: string;
  requesterName: string;
  date: string;
  periods: BookingPeriodType[];
  status: BookingStatus;
  createdAt: string | null;
};

export type OwnerHallBookingRequestsLoadStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

export type OwnerHallBookingRequestsErrorKind =
  | "network"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "generic";
