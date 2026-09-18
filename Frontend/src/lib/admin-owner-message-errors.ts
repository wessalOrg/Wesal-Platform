import { ApiError } from "@/lib/api-error";

export type AdminOwnerMessageErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation"
  | "network"
  | "generic";

export class AdminOwnerMessageError extends ApiError {
  kind: AdminOwnerMessageErrorKind;

  constructor(message: string, status?: number, kind: AdminOwnerMessageErrorKind = "generic") {
    super(message, status);
    this.name = "AdminOwnerMessageError";
    this.kind = kind;
  }
}

export function toAdminOwnerMessageError(err: unknown): AdminOwnerMessageError {
  if (err instanceof AdminOwnerMessageError) return err;

  const status = err instanceof ApiError ? err.status : undefined;
  const blob = (
    err instanceof ApiError
      ? `${err.message} ${err.detail ?? ""} ${err.code ?? ""}`
      : err instanceof Error
        ? err.message
        : String(err ?? "")
  ).toLowerCase();

  if (status === 401) {
    return new AdminOwnerMessageError("admin.halls.message.errors.unauthorized", 401, "unauthorized");
  }
  if (status === 403) {
    return new AdminOwnerMessageError("admin.halls.message.errors.forbidden", 403, "forbidden");
  }
  if (status === 404) {
    return new AdminOwnerMessageError("admin.halls.message.errors.notFound", 404, "not_found");
  }
  if (status === 400 || status === 422 || blob.includes("content") || blob.includes("required")) {
    return new AdminOwnerMessageError("admin.halls.message.errors.validation", status ?? 422, "validation");
  }
  if (!status || blob.includes("network") || blob.includes("timeout")) {
    return new AdminOwnerMessageError("admin.halls.message.errors.network", status, "network");
  }
  return new AdminOwnerMessageError("admin.halls.message.errors.generic", status, "generic");
}
