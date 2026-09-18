import { ApiError } from "@/lib/api-error";
import { tryParseOwnerBookingRequestStatus } from "@/lib/owner-booking-status";
import type { OwnerBookingRequestStatus } from "@/types/hall-notifications";

export type AcceptBookingErrorKind =
  | "cancelled"
  | "conflict"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "generic";

export class AcceptBookingError extends ApiError {
  kind: AcceptBookingErrorKind;
  resolvedStatus: OwnerBookingRequestStatus | null;

  constructor(
    message: string,
    status?: number,
    extras?: { kind?: AcceptBookingErrorKind; resolvedStatus?: OwnerBookingRequestStatus | null },
  ) {
    super(message, status);
    this.name = "AcceptBookingError";
    this.kind = extras?.kind ?? "generic";
    this.resolvedStatus = extras?.resolvedStatus ?? null;
  }
}

function blobFromUnknown(err: unknown): string {
  if (err instanceof ApiError) {
    const details =
      err.details && typeof err.details === "object"
        ? JSON.stringify(err.details)
        : typeof err.details === "string"
          ? err.details
          : "";
    return `${err.message} ${err.detail ?? ""} ${err.code ?? ""} ${details}`.toLowerCase();
  }
  if (err instanceof Error) return err.message.toLowerCase();
  return String(err ?? "").toLowerCase();
}

function statusFromDetails(err: unknown): OwnerBookingRequestStatus | null {
  if (!(err instanceof ApiError) || !err.details || typeof err.details !== "object") return null;
  const record = err.details as Record<string, unknown>;
  const nested =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : null;
  const raw = record.status ?? record.bookingStatus ?? nested?.status ?? nested?.bookingStatus;
  return tryParseOwnerBookingRequestStatus(
    typeof raw === "string" || typeof raw === "number" ? raw : null,
  );
}

function resolvedStatusFromBlob(blob: string): OwnerBookingRequestStatus | null {
  if (
    blob.includes("cancelled") ||
    blob.includes("canceled") ||
    blob.includes("ألغى") ||
    blob.includes("الغى") ||
    blob.includes("ملغى") ||
    blob.includes("تم إلغاء")
  ) {
    return "Cancelled";
  }
  if (blob.includes("rejected") || blob.includes("مرفوض")) return "Rejected";
  if (blob.includes("fully booked") || blob.includes("fullybooked")) return "FullyBooked";
  if (blob.includes("already accepted") || blob.includes("already been accepted")) {
    return "AcceptedPendingDeposit";
  }
  return null;
}

export function toAcceptBookingError(err: unknown): AcceptBookingError {
  if (err instanceof AcceptBookingError) return err;

  const blob = blobFromUnknown(err);
  const status = err instanceof ApiError ? err.status : undefined;
  const resolved = statusFromDetails(err) ?? resolvedStatusFromBlob(blob);

  if (
    resolved === "Cancelled" ||
    blob.includes("customer cancelled") ||
    blob.includes("seeker cancelled") ||
    blob.includes("customer canceled")
  ) {
    return new AcceptBookingError("errors.owner.accept.cancelled", status ?? 409, {
      kind: "cancelled",
      resolvedStatus: "Cancelled",
    });
  }

  if (status === 409 || status === 400) {
    return new AcceptBookingError("errors.owner.accept.conflict", status, {
      kind: "conflict",
      resolvedStatus: resolved,
    });
  }
  if (status === 401) {
    return new AcceptBookingError("errors.owner.accept.unauthorized", 401, { kind: "unauthorized" });
  }
  if (status === 403) {
    return new AcceptBookingError("errors.owner.accept.forbidden", 403, { kind: "forbidden" });
  }
  if (status === 404) {
    return new AcceptBookingError("errors.owner.accept.notFound", 404, { kind: "not_found" });
  }

  return new AcceptBookingError("errors.owner.accept.generic", status, { kind: "generic" });
}
