import { ApiError } from "@/lib/api-error";

export type UnlockHallErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "network"
  | "generic";

export class UnlockHallError extends ApiError {
  kind: UnlockHallErrorKind;

  constructor(message: string, status?: number, kind: UnlockHallErrorKind = "generic") {
    super(message, status);
    this.name = "UnlockHallError";
    this.kind = kind;
  }
}

export function toUnlockHallError(err: unknown): UnlockHallError {
  if (err instanceof UnlockHallError) return err;

  const status = err instanceof ApiError ? err.status : undefined;
  const blob = (
    err instanceof ApiError
      ? `${err.message} ${err.detail ?? ""} ${err.code ?? ""}`
      : err instanceof Error
        ? err.message
        : String(err ?? "")
  ).toLowerCase();

  if (status === 401) {
    return new UnlockHallError("admin.halls.unlock.errors.unauthorized", 401, "unauthorized");
  }
  if (status === 403) {
    return new UnlockHallError("admin.halls.unlock.errors.forbidden", 403, "forbidden");
  }
  if (status === 404) {
    return new UnlockHallError("admin.halls.unlock.errors.notFound", 404, "not_found");
  }
  if (!status || blob.includes("network") || blob.includes("timeout")) {
    return new UnlockHallError("admin.halls.unlock.errors.network", status, "network");
  }
  return new UnlockHallError("admin.halls.unlock.errors.generic", status, "generic");
}
