import { ApiError } from "@/lib/api-error";

export type ApproveHallErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "not_pending"
  | "network"
  | "generic";

export class ApproveHallError extends ApiError {
  kind: ApproveHallErrorKind;

  constructor(message: string, status?: number, kind: ApproveHallErrorKind = "generic") {
    super(message, status);
    this.name = "ApproveHallError";
    this.kind = kind;
  }
}

export function toApproveHallError(err: unknown): ApproveHallError {
  if (err instanceof ApproveHallError) return err;

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
    return new ApproveHallError("admin.halls.approve.errors.unauthorized", 401, "unauthorized");
  }
  if (status === 403) {
    return new ApproveHallError("admin.halls.approve.errors.forbidden", 403, "forbidden");
  }
  if (status === 404) {
    return new ApproveHallError("admin.halls.approve.errors.notFound", 404, "not_found");
  }
  if (status === 422 || code === "hallnotpending" || blob.includes("notpending") || blob.includes("cannot be approved")) {
    return new ApproveHallError("admin.halls.approve.errors.notPending", 422, "not_pending");
  }
  if (!status || blob.includes("network") || blob.includes("timeout")) {
    return new ApproveHallError("admin.halls.approve.errors.network", status, "network");
  }
  return new ApproveHallError("admin.halls.approve.errors.generic", status, "generic");
}
