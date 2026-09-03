import { ApiError } from "@/lib/api-error";
import { BookingError } from "@/lib/booking-errors";
import type { BookingStatus } from "@/types/booking";

export function finalizedCancelMessageKey(status: BookingStatus): string {
  if (status === "Accepted") return "errors.booking.cancel.accepted";
  if (status === "Rejected") return "errors.booking.cancel.rejected";
  if (status === "Cancelled") return "errors.booking.cancel.cancelled";
  return "errors.booking.cancel.finalized";
}

export function parseFinalizedStatus(blob: string): BookingStatus | null {
  const text = blob.toLowerCase();
  if (
    text.includes("already accepted") ||
    text.includes("already been accepted") ||
    text.includes("was already accepted")
  ) {
    return "Accepted";
  }
  if (
    text.includes("already rejected") ||
    text.includes("already been rejected") ||
    text.includes("was already rejected")
  ) {
    return "Rejected";
  }
  if (
    text.includes("already been cancelled") ||
    text.includes("already cancelled") ||
    text.includes("has already been cancelled")
  ) {
    return "Cancelled";
  }
  return null;
}

function blobFromError(err: { message?: string; details?: unknown }): string {
  const details =
    err.details && typeof err.details === "object"
      ? JSON.stringify(err.details)
      : typeof err.details === "string"
        ? err.details
        : "";
  return `${err.message ?? ""} ${details}`;
}

export function toCancelBookingError(err: unknown): BookingError {
  if (err instanceof BookingError) {
    if (err.status !== 409) return err;
    const finalized = parseFinalizedStatus(blobFromError(err));
    return new BookingError(
      finalized ? finalizedCancelMessageKey(finalized) : "errors.booking.cancel.finalized",
      409,
      { kind: "conflict", details: err.details },
    );
  }

  if (err instanceof ApiError) {
    if (err.status === 409) {
      const finalized = parseFinalizedStatus(blobFromError(err));
      return new BookingError(
        finalized ? finalizedCancelMessageKey(finalized) : "errors.booking.cancel.finalized",
        409,
        { kind: "conflict", details: err.details },
      );
    }
    if (err.status === 401) {
      return new BookingError("errors.booking.cancel.unauthorized", 401, { kind: "unauthorized" });
    }
    if (err.status === 403) {
      return new BookingError("errors.booking.cancel.forbidden", 403, { kind: "forbidden" });
    }
    if (err.status === 404) {
      return new BookingError("errors.booking.cancel.notFound", 404, { kind: "not_found" });
    }
    return new BookingError("errors.booking.cancel.generic", err.status, {
      kind: "generic",
      details: err.details,
    });
  }

  return new BookingError("errors.booking.cancel.generic");
}

export function finalizedStatusFromError(err: BookingError): BookingStatus | null {
  if (err.status !== 409) return null;
  if (err.message === "errors.booking.cancel.accepted") return "Accepted";
  if (err.message === "errors.booking.cancel.rejected") return "Rejected";
  if (err.message === "errors.booking.cancel.cancelled") return "Cancelled";
  return parseFinalizedStatus(err.message);
}
