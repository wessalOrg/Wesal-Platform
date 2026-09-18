import { ApiError } from "@/lib/api-error";
import { tryParseOwnerBookingRequestStatus } from "@/lib/owner-booking-status";
import type { OwnerBookingRequestStatus } from "@/types/hall-notifications";

export type PublishBookingErrorKind =
  | "cancelled"
  | "conflict"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "generic";

export class PublishBookingError extends ApiError {
  kind: PublishBookingErrorKind;
  resolvedStatus: OwnerBookingRequestStatus | null;
  backendMessage: string | null;

  constructor(
    message: string,
    status?: number,
    extras?: {
      kind?: PublishBookingErrorKind;
      resolvedStatus?: OwnerBookingRequestStatus | null;
      backendMessage?: string | null;
    },
  ) {
    super(message, status);
    this.name = "PublishBookingError";
    this.kind = extras?.kind ?? "generic";
    this.resolvedStatus = extras?.resolvedStatus ?? null;
    this.backendMessage = extras?.backendMessage ?? null;
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

function looksLikeI18nKey(value: string): boolean {
  return value.startsWith("errors.") || value.startsWith("owner.");
}

export function publicBackendMessage(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const candidates = [err.detail, err.message];
  for (const candidate of candidates) {
    const text = candidate?.trim();
    if (text && !looksLikeI18nKey(text)) return text;
  }
  return null;
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

export function toPublishBookingError(err: unknown): PublishBookingError {
  if (err instanceof PublishBookingError) return err;

  const blob = blobFromUnknown(err);
  const status = err instanceof ApiError ? err.status : undefined;
  const resolved = statusFromDetails(err);
  const backendMessage = publicBackendMessage(err);

  if (
    resolved === "Cancelled" ||
    blob.includes("cancelled") ||
    blob.includes("canceled") ||
    blob.includes("ملغى")
  ) {
    return new PublishBookingError(backendMessage || "errors.owner.publish.cancelled", status ?? 409, {
      kind: "cancelled",
      resolvedStatus: "Cancelled",
      backendMessage,
    });
  }

  if (blob.includes("already published") || blob.includes("already booked") || blob.includes("منشور")) {
    return new PublishBookingError(backendMessage || "errors.owner.publish.conflict", status ?? 409, {
      kind: "conflict",
      resolvedStatus: "FullyBooked",
      backendMessage,
    });
  }

  if (status === 409 || status === 400) {
    return new PublishBookingError(backendMessage || "errors.owner.publish.conflict", status, {
      kind: "conflict",
      resolvedStatus: resolved,
      backendMessage,
    });
  }
  if (status === 401) {
    return new PublishBookingError("errors.owner.publish.unauthorized", 401, { kind: "unauthorized" });
  }
  if (status === 403) {
    return new PublishBookingError("errors.owner.publish.forbidden", 403, { kind: "forbidden" });
  }
  if (status === 404) {
    return new PublishBookingError("errors.owner.publish.notFound", 404, { kind: "not_found" });
  }

  return new PublishBookingError(backendMessage || "errors.owner.publish.generic", status, {
    kind: "generic",
    backendMessage,
  });
}
