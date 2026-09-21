import type { OwnerBookingRequestStatus } from "@/types/hall-notifications";

export function tryParseOwnerBookingRequestStatus(
  value: string | number | null | undefined,
): OwnerBookingRequestStatus | null {
  if (value == null || value === "") return null;
  if (value === 0 || value === "0") return "Pending";
  if (value === 1 || value === "1") return "Rejected";
  if (value === 3 || value === "3") return "Cancelled";
  if (value === 2 || value === "2") return "AcceptedPendingDeposit";

  const normalized = String(value).trim().toLowerCase().replace(/[_\s-]+/g, "");
  if (!normalized) return null;

  if (normalized === "pending") return "Pending";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "cancelled" || normalized === "canceled") return "Cancelled";
  if (
    normalized === "fullybooked" ||
    normalized === "depositconfirmed" ||
    normalized === "confirmeddeposit" ||
    normalized === "bothdepositsconfirmed" ||
    normalized === "published" ||
    normalized === "booked"
  ) {
    return "FullyBooked";
  }
  if (
    normalized === "accepted" ||
    normalized === "approved" ||
    normalized === "acceptedpendingdeposit" ||
    normalized === "depositpending" ||
    normalized === "pendingdeposit"
  ) {
    return "AcceptedPendingDeposit";
  }
  return null;
}

export function parseOwnerBookingRequestStatus(
  value: string | number | null | undefined,
): OwnerBookingRequestStatus {
  return tryParseOwnerBookingRequestStatus(value) ?? "Pending";
}

export function canAcceptBookingRequest(status: OwnerBookingRequestStatus | null): boolean {
  return status == null || status === "Pending";
}

export function canRejectBookingRequest(status: OwnerBookingRequestStatus | null): boolean {
  return canAcceptBookingRequest(status);
}

/** Successful owner accept starts deposit confirmation — never Fully Booked. */
export function statusAfterOwnerAccept(): OwnerBookingRequestStatus {
  return "AcceptedPendingDeposit";
}

/** Successful publish always lands on Booked/Published. Never infer this from a failed response. */
export function statusAfterOwnerPublish(): "FullyBooked" {
  return "FullyBooked";
}

export function ownerRequestStatusMessageKey(status: OwnerBookingRequestStatus): string {
  if (status === "AcceptedPendingDeposit") return "owner.notifications.status.pendingDeposit";
  if (status === "FullyBooked") return "owner.notifications.status.fullyBooked";
  if (status === "Rejected") return "bookings.status.rejected";
  if (status === "Cancelled") return "bookings.status.cancelled";
  return "bookings.status.pending";
}
