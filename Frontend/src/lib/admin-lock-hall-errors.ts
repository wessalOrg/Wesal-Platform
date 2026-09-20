import { ApiError } from "@/lib/api-error";

export type LockHallErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "network"
  | "generic";

export class LockHallError extends ApiError {
  kind: LockHallErrorKind;

  constructor(message: string, status?: number, kind: LockHallErrorKind = "generic") {
    super(message, status);
    this.name = "LockHallError";
    this.kind = kind;
  }
}

export function toLockHallError(err: unknown): LockHallError {
  if (err instanceof LockHallError) return err;

  const status = err instanceof ApiError ? err.status : undefined;
  const blob = (
    err instanceof ApiError
      ? `${err.message} ${err.detail ?? ""} ${err.code ?? ""}`
      : err instanceof Error
        ? err.message
        : String(err ?? "")
  ).toLowerCase();

  if (status === 401) {
    return new LockHallError("admin.lock.errors.unauthorized", 401, "unauthorized");
  }
  if (status === 403) {
    return new LockHallError("admin.lock.errors.forbidden", 403, "forbidden");
  }
  if (status === 404) {
    return new LockHallError("admin.lock.errors.notFound", 404, "not_found");
  }
  if (status === 409 || blob.includes("already locked")) {
    return new LockHallError("admin.lock.errors.conflict", 409, "conflict");
  }
  if (!status || blob.includes("network") || blob.includes("timeout")) {
    return new LockHallError("admin.lock.errors.network", status, "network");
  }
  return new LockHallError("admin.lock.errors.generic", status, "generic");
}
