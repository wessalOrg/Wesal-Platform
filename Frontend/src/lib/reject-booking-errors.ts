import { ApiError } from "@/lib/api-error";
import { tryParseOwnerBookingRequestStatus } from "@/lib/owner-booking-status";
import type { OwnerBookingRequestStatus } from "@/types/hall-notifications";

export type RejectBookingErrorKind =
  | "cancelled"
  | "conflict"
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "generic";

export class RejectBookingError extends ApiError {
  kind: RejectBookingErrorKind;
  resolvedStatus: OwnerBookingRequestStatus | null;

  constructor(
    message: string,
    status?: number,
    extras?: { kind?: RejectBookingErrorKind; resolvedStatus?: OwnerBookingRequestStatus | null },
  ) {
    super(message, status);
    this.name = "RejectBookingError";
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

export function toRejectBookingError(err: unknown): RejectBookingError {
  if (err instanceof RejectBookingError) return err;

  const blob = blobFromUnknown(err);
  const status = err instanceof ApiError ? err.status : undefined;
  const resolved = statusFromDetails(err);

  if (blob.includes("reason is required") || blob.includes("rejection reason")) {
    return new RejectBookingError("errors.owner.reject.required", status ?? 400, {
      kind: "validation",
    });
  }

  if (
    resolved === "Cancelled" ||
    blob.includes("cancelled") ||
    blob.includes("canceled") ||
    blob.includes("ملغى")
  ) {
    return new RejectBookingError("errors.owner.reject.cancelled", status ?? 409, {
      kind: "cancelled",
      resolvedStatus: "Cancelled",
    });
  }

  if (status === 409 || status === 400) {
    return new RejectBookingError("errors.owner.reject.conflict", status, {
      kind: "conflict",
      resolvedStatus: resolved,
    });
  }
  if (status === 401) {
    return new RejectBookingError("errors.owner.reject.unauthorized", 401, { kind: "unauthorized" });
  }
  if (status === 403) {
    return new RejectBookingError("errors.owner.reject.forbidden", 403, { kind: "forbidden" });
  }
  if (status === 404) {
    return new RejectBookingError("errors.owner.reject.notFound", 404, { kind: "not_found" });
  }

  return new RejectBookingError("errors.owner.reject.generic", status, { kind: "generic" });
}
