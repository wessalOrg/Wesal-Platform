import type { BookingPeriodType, BookingStatus } from "@/types/booking";

/** Hall-scoped incoming booking request for owner notifications (US-OWNER-09). */
export type OwnerHallBookingRequest = {
  id: string;
  hallId: string;
  requesterName: string;
  requesterUserId?: string;
  date: string;
  periods: BookingPeriodType[];
  slotStarts?: string[];
  timeRange?: string;
  status: BookingStatus;
  depositAmount?: number | null;
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
