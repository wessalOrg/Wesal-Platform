import { ApiError } from "@/lib/api-error";

export type RejectHallErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "network"
  | "generic";

export class RejectHallError extends ApiError {
  kind: RejectHallErrorKind;

  constructor(message: string, status?: number, kind: RejectHallErrorKind = "generic") {
    super(message, status);
    this.name = "RejectHallError";
    this.kind = kind;
  }
}

export function toRejectHallError(err: unknown): RejectHallError {
  if (err instanceof RejectHallError) return err;

  const status = err instanceof ApiError ? err.status : undefined;
  const code = err instanceof ApiError ? (err.code ?? "").toLowerCase() : "";
  const blob = (
    err instanceof ApiError
      ? `${err.message} ${err.detail ?? ""} ${err.code ?? ""}`
      : err instanceof Error
        ? err.message
        : String(err ?? "")
  ).toLowerCase();

  if (status === 401) {
    return new RejectHallError("admin.reject.errors.unauthorized", 401, "unauthorized");
  }
  if (status === 403) {
    return new RejectHallError("admin.reject.errors.forbidden", 403, "forbidden");
  }
  if (status === 404) {
    return new RejectHallError("admin.reject.errors.notFound", 404, "not_found");
  }
  if (status === 409 || blob.includes("already been approved") || blob.includes("confirm")) {
    return new RejectHallError("admin.reject.errors.conflict", 409, "conflict");
  }
  if (
    status === 422 ||
    code === "hallnotpending" ||
    blob.includes("cannot be rejected") ||
    blob.includes("validation")
  ) {
    return new RejectHallError("admin.reject.errors.validation", status ?? 422, "validation");
  }
  if (!status || blob.includes("network") || blob.includes("timeout")) {
    return new RejectHallError("admin.reject.errors.network", status, "network");
  }
  return new RejectHallError("admin.reject.errors.generic", status, "generic");
}
