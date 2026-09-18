import { ApiError } from "@/lib/api-error";

export type DeleteBookingErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "generic";

export class DeleteBookingError extends ApiError {
  kind: DeleteBookingErrorKind;
  backendMessage: string | null;

  constructor(
    message: string,
    status?: number,
    extras?: {
      kind?: DeleteBookingErrorKind;
      backendMessage?: string | null;
    },
  ) {
    super(message, status);
    this.name = "DeleteBookingError";
    this.kind = extras?.kind ?? "generic";
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

function publicBackendMessage(err: unknown): string | null {
  if (!(err instanceof ApiError)) return null;
  const candidates = [err.detail, err.message];
  for (const candidate of candidates) {
    const text = candidate?.trim();
    if (text && !looksLikeI18nKey(text)) return text;
  }
  return null;
}

export function toDeleteBookingError(err: unknown): DeleteBookingError {
  if (err instanceof DeleteBookingError) return err;

  const blob = blobFromUnknown(err);
  const status = err instanceof ApiError ? err.status : undefined;
  const backendMessage = publicBackendMessage(err);

  if (status === 401) {
    return new DeleteBookingError("errors.owner.delete.unauthorized", 401, {
      kind: "unauthorized",
    });
  }
  if (status === 403) {
    return new DeleteBookingError("errors.owner.delete.forbidden", 403, {
      kind: "forbidden",
    });
  }
  if (
    status === 404 ||
    blob.includes("already deleted") ||
    blob.includes("already been deleted")
  ) {
    return new DeleteBookingError(backendMessage || "errors.owner.delete.notFound", status ?? 404, {
      kind: "not_found",
      backendMessage,
    });
  }
  if (
    status === 409 ||
    status === 400 ||
    blob.includes("cannot delete") ||
    blob.includes("can not delete") ||
    blob.includes("cannot be deleted") ||
    blob.includes("لا يمكن حذف")
  ) {
    return new DeleteBookingError(backendMessage || "errors.owner.delete.conflict", status ?? 409, {
      kind: "conflict",
      backendMessage,
    });
  }

  return new DeleteBookingError(backendMessage || "errors.owner.delete.generic", status, {
    kind: "generic",
    backendMessage,
  });
}
