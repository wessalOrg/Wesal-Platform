import { ApiError } from "@/lib/api-error";

export type DeleteHallErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "generic";

export class DeleteHallError extends ApiError {
  kind: DeleteHallErrorKind;
  backendMessage: string | null;

  constructor(
    message: string,
    status?: number,
    extras?: {
      kind?: DeleteHallErrorKind;
      backendMessage?: string | null;
    },
  ) {
    super(message, status);
    this.name = "DeleteHallError";
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

export function toDeleteHallError(err: unknown): DeleteHallError {
  if (err instanceof DeleteHallError) return err;

  const blob = blobFromUnknown(err);
  const status = err instanceof ApiError ? err.status : undefined;
  const backendMessage = publicBackendMessage(err);

  if (status === 401) {
    return new DeleteHallError("errors.owner.hall.unauthorized", 401, { kind: "unauthorized" });
  }
  if (status === 403) {
    return new DeleteHallError("errors.owner.hall.forbidden", 403, { kind: "forbidden" });
  }
  if (status === 404 || status === 410 || blob.includes("already deleted")) {
    return new DeleteHallError(backendMessage || "errors.owner.hall.notFound", status ?? 404, {
      kind: "not_found",
      backendMessage,
    });
  }
  if (
    status === 409 ||
    status === 400 ||
    blob.includes("cannot delete") ||
    blob.includes("can not delete") ||
    blob.includes("active booking") ||
    blob.includes("open booking") ||
    blob.includes("حجوزات") ||
    blob.includes("لا يمكن حذف")
  ) {
    return new DeleteHallError(backendMessage || "errors.owner.hall.conflict", status ?? 409, {
      kind: "conflict",
      backendMessage,
    });
  }

  return new DeleteHallError(backendMessage || "errors.owner.hall.generic", status, {
    kind: "generic",
    backendMessage,
  });
}
