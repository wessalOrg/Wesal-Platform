import { ApiError } from "@/lib/api-error";

export type OwnerAvailabilityErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "generic";

export class OwnerAvailabilityError extends ApiError {
  kind: OwnerAvailabilityErrorKind;
  backendMessage: string | null;

  constructor(
    message: string,
    status?: number,
    extras?: {
      kind?: OwnerAvailabilityErrorKind;
      backendMessage?: string | null;
    },
  ) {
    super(message, status);
    this.name = "OwnerAvailabilityError";
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

export function toOwnerAvailabilityError(err: unknown): OwnerAvailabilityError {
  if (err instanceof OwnerAvailabilityError) return err;

  const blob = blobFromUnknown(err);
  const status = err instanceof ApiError ? err.status : undefined;
  const backendMessage = publicBackendMessage(err);

  if (status === 401) {
    return new OwnerAvailabilityError("errors.owner.availability.unauthorized", 401, {
      kind: "unauthorized",
    });
  }
  if (status === 403) {
    return new OwnerAvailabilityError("errors.owner.availability.forbidden", 403, {
      kind: "forbidden",
    });
  }
  if (status === 404) {
    return new OwnerAvailabilityError("errors.owner.availability.notFound", 404, {
      kind: "not_found",
      backendMessage,
    });
  }
  if (
    status === 409 ||
    status === 400 ||
    blob.includes("already booked") ||
    blob.includes("cannot update") ||
    blob.includes("cannot change") ||
    blob.includes("blocked") ||
    blob.includes("محجوز") ||
    blob.includes("لا يمكن")
  ) {
    return new OwnerAvailabilityError(
      backendMessage || "errors.owner.availability.conflict",
      status ?? 409,
      { kind: "conflict", backendMessage },
    );
  }

  return new OwnerAvailabilityError(backendMessage || "errors.owner.availability.generic", status, {
    kind: "generic",
    backendMessage,
  });
}

export function hallAvailabilityErrorMessageKey(kind: OwnerAvailabilityErrorKind): string {
  if (kind === "unauthorized") return "errors.owner.availability.unauthorized";
  if (kind === "forbidden") return "errors.owner.availability.forbidden";
  if (kind === "not_found") return "errors.owner.availability.notFound";
  if (kind === "conflict") return "errors.owner.availability.conflict";
  return "errors.owner.availability.load";
}
